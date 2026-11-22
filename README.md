# TRAPERO AI

TRAPERO AI es el núcleo privado de una plataforma multimodelo. Esta primera versión
incluye autenticación, conversaciones persistentes, selector automático y manual de
proveedores, carga de archivos, panel de consumo y generación real de TXT, CSV, DOCX,
XLSX, PDF y PPTX.

## Inicio rápido

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

La API estará disponible en `http://localhost:8000`. La documentación interactiva
estará en `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Abre `http://localhost:3000`.

## Docker

```bash
docker compose up --build
```

Los servicios se publican en `http://localhost:3000` y `http://localhost:8000`.

## Credenciales necesarias

Configura solo las claves de los proveedores que quieras activar:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `TRAPERO_APP_SECRET`

Las claves nunca se sirven al navegador. Sin una clave, el proveedor responde como no
configurado y el selector automático puede continuar con el siguiente proveedor.
