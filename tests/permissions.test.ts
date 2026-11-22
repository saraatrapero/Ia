import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canRunAgent, isValidCron, toolAllowed } from "../src/lib/agents/registry";
import { can } from "../src/lib/permissions";

describe("permisos", () => {
  it("un miembro no gestiona usuarios", () => assert.equal(can("MEMBER", "users.manage"), false));
  it("un responsable ve el consumo global", () => assert.equal(can("MANAGER", "usage.view_all"), true));
  it("un administrador puede todo", () => assert.equal(can("ADMIN", "security.manage"), true));
  it("un rol desconocido no tiene privilegios", () => assert.equal(can("HACKER", "usage.view_all"), false));
});

describe("agentes", () => {
  it("la ejecución está bloqueada", () => assert.equal(canRunAgent().ok, false));
  it("solo lectura no puede generar archivos", () => assert.equal(toolAllowed("read", "files.generate"), false));
  it("nadie puede enviar correos en esta fase", () => assert.equal(toolAllowed("execute", "email.send"), false));
  it("valida expresiones cron", () => {
    assert.equal(isValidCron("0 8 * * 1-5"), true);
    assert.equal(isValidCron("todos los días"), false);
  });
});
