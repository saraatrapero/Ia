import hashlib
import hmac
import os
import secrets
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr

from .database import get_connection, initialize_database
from .providers import generate


APP_SECRET = os.getenv("TRAPERO_APP_SECRET", secrets.token_hex(32))
STORAGE_PATH = Path(os.getenv("TRAPERO_STORAGE", "/tmp/trapero-storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TRAPERO AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("TRAPERO_CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChatRequest(BaseModel):
    message: str
    provider: Literal["auto", "openai", "anthropic", "gemini"] = "auto"
    conversation_id: int | None = None


class DocumentRequest(BaseModel):
    title: str
    content: str
    format: Literal["txt", "csv", "docx", "xlsx", "pdf", "pptx"]


def password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def password_valid(password: str, stored: str) -> bool:
    try:
        _, salt, expected = stored.split("$", 2)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 240_000).hex()
        return hmac.compare_digest(actual, expected)
    except (TypeError, ValueError):
        return False


def create_session(user_id: int) -> str:
    payload = f"{user_id}:{secrets.token_hex(16)}"
    signature = hmac.new(APP_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def require_user(authorization: str | None = Header(default=None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida")
    token = authorization.removeprefix("Bearer ")
    try:
        payload, signature = token.rsplit(":", 1)
        expected = hmac.new(APP_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        return int(payload.split(":", 1)[0])
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Sesión inválida")


@app.on_event("startup")
def startup():
    initialize_database()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "trapero-ai"}


@app.post("/api/auth/register")
def register(request: RegisterRequest):
    with get_connection() as connection:
        try:
            cursor = connection.execute(
                "INSERT INTO users(email, password_hash, role) VALUES (?, ?, 'owner')",
                (request.email.lower(), password_hash(request.password)),
            )
            user_id = cursor.lastrowid
        except Exception as exc:
            raise HTTPException(status_code=409, detail="El usuario ya existe") from exc
    return {"token": create_session(user_id), "user": {"id": user_id, "email": request.email.lower(), "role": "owner"}}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    with get_connection() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (request.email.lower(),)).fetchone()
    if not user or not password_valid(request.password, user["password_hash"]) or not user["active"]:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"token": create_session(user["id"]), "user": {"id": user["id"], "email": user["email"], "role": user["role"]}}


@app.get("/api/dashboard")
def dashboard(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with get_connection() as connection:
        conversation_count = connection.execute(
            "SELECT COUNT(*) FROM conversations WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        usage = connection.execute(
            "SELECT COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), "
            "COALESCE(SUM(estimated_cost), 0) FROM usage_events WHERE user_id = ?", (user_id,)
        ).fetchone()
        recent = [dict(row) for row in connection.execute(
            "SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT 5",
            (user_id,),
        )]
    return {"conversations": conversation_count, "input_tokens": usage[0], "output_tokens": usage[1],
            "estimated_cost": round(usage[2], 6), "recent_conversations": recent}


@app.post("/api/chat")
async def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with get_connection() as connection:
        if request.conversation_id:
            conversation = connection.execute(
                "SELECT id FROM conversations WHERE id = ? AND user_id = ?", (request.conversation_id, user_id)
            ).fetchone()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversación no encontrada")
            conversation_id = request.conversation_id
        else:
            cursor = connection.execute(
                "INSERT INTO conversations(user_id, title) VALUES (?, ?)",
                (user_id, request.message[:60] or "Nueva conversación"),
            )
            conversation_id = cursor.lastrowid
        connection.execute(
            "INSERT INTO messages(conversation_id, role, content) VALUES (?, 'user', ?)",
            (conversation_id, request.message),
        )

    providers = ["openai", "anthropic", "gemini"] if request.provider == "auto" else [request.provider]
    errors = []
    result = None
    for provider in providers:
        try:
            result = await generate(provider, request.message)
            break
        except Exception as exc:
            errors.append(f"{provider}: {str(exc)}")

    if not result:
        raise HTTPException(status_code=502, detail="; ".join(errors) or "Ningún proveedor disponible")

    cost = (result["input_tokens"] * 0.000001) + (result["output_tokens"] * 0.000003)
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO messages(conversation_id, role, content, provider, model, tokens) "
            "VALUES (?, 'assistant', ?, ?, ?, ?)",
            (conversation_id, result["text"], result["provider"], result["model"],
             result["input_tokens"] + result["output_tokens"]),
        )
        connection.execute(
            "INSERT INTO usage_events(user_id, provider, model, input_tokens, output_tokens, estimated_cost) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, result["provider"], result["model"], result["input_tokens"],
             result["output_tokens"], cost),
        )
        connection.execute(
            "INSERT INTO audit_events(user_id, action, resource) VALUES (?, 'chat', ?)",
            (user_id, f"conversation:{conversation_id}"),
        )

    return {"conversation_id": conversation_id, "fallback_used": len(errors) > 0, **result}


@app.get("/api/conversations")
def conversations(authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return {"conversations": [dict(row) for row in rows]}


@app.get("/api/conversations/{conversation_id}")
def conversation_messages(conversation_id: int, authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    with get_connection() as connection:
        conversation = connection.execute(
            "SELECT id, title FROM conversations WHERE id = ? AND user_id = ?", (conversation_id, user_id)
        ).fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversación no encontrada")
        messages = connection.execute(
            "SELECT id, role, content, provider, model, created_at FROM messages "
            "WHERE conversation_id = ? ORDER BY id", (conversation_id,)
        ).fetchall()
    return {"conversation": dict(conversation), "messages": [dict(row) for row in messages]}


@app.post("/api/files")
async def upload_file(upload: UploadFile = File(...), authorization: str | None = Header(default=None)):
    user_id = require_user(authorization)
    data = await upload.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El archivo supera 20 MB")
    destination = STORAGE_PATH / f"{user_id}_{secrets.token_hex(16)}.upload"
    destination.write_bytes(data)
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO files(owner_id, filename, storage_path, file_type) VALUES (?, ?, ?, ?)",
            (user_id, upload.filename or "file", str(destination), upload.content_type),
        )
    return {"id": cursor.lastrowid, "filename": upload.filename, "size": len(data)}


@app.post("/api/documents")
def create_document(request: DocumentRequest, authorization: str | None = Header(default=None)):
    require_user(authorization)
    path = STORAGE_PATH / f"document_{secrets.token_hex(16)}.{request.format}"

    if request.format == "txt":
        path.write_text(request.content, encoding="utf-8")
    elif request.format == "csv":
        lines = request.content.splitlines()
        with path.open("w", encoding="utf-8", newline="") as output:
            for line in lines:
                output.write(",".join(f'"{cell.strip().replace(chr(34), chr(34)*2)}"'
                                      for cell in line.split(",")) + "\n")
    elif request.format == "docx":
        from docx import Document
        document = Document()
        document.add_heading(request.title, 0)
        for paragraph in request.content.splitlines():
            document.add_paragraph(paragraph)
        document.save(path)
    elif request.format == "xlsx":
        from openpyxl import Workbook
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Datos"
        sheet["A1"] = request.title
        for row_index, line in enumerate(request.content.splitlines(), start=3):
            for column_index, value in enumerate(line.split(","), start=1):
                sheet.cell(row=row_index, column=column_index, value=value)
        workbook.save(path)
    elif request.format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        pdf = canvas.Canvas(str(path), pagesize=A4)
        pdf.setTitle(request.title)
        text = pdf.beginText(50, 800)
        text.setFont("Helvetica", 11)
        text.textLine(request.title)
        for line in request.content.splitlines():
            text.textLine(line[:110])
        pdf.drawText(text)
        pdf.save()
    elif request.format == "pptx":
        from pptx import Presentation
        presentation = Presentation()
        slide = presentation.slides.add_slide(presentation.slide_layouts[0])
        slide.shapes.title.text = request.title
        slide.placeholders[1].text = request.content[:1000]
        presentation.save(path)

    return FileResponse(path, filename=path.name)
