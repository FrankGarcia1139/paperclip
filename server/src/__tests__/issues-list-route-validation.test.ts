/**
 * Regression tests for POLAAA-35 — issue list route must reject malformed UUID
 * filter params with a 400 instead of propagating them to Postgres (which
 * returns a 500 "invalid input syntax for type uuid").
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const validAgentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const validProjectId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const mockIssueService = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  checkout: vi.fn(),
  release: vi.fn(),
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  listComments: vi.fn(),
  getComment: vi.fn(),
  listAttachments: vi.fn(),
  getHeartbeatContext: vi.fn(),
  listWorkProducts: vi.fn(),
  createWorkProduct: vi.fn(),
  updateWorkProduct: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  resolveByReference: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  getActiveRunForAgent: vi.fn(),
  listTaskSessions: vi.fn(),
}));

const mockProjectService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockGoalService = vi.hoisted(() => ({
  getById: vi.fn(),
  getDefaultCompanyGoal: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockExecutionWorkspaceService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockWorkProductService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const mockDocumentService = vi.hoisted(() => ({
  get: vi.fn(),
  upsert: vi.fn(),
  list: vi.fn(),
  getRevisions: vi.fn(),
}));

const mockRoutineService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  heartbeatService: () => mockHeartbeatService,
  projectService: () => mockProjectService,
  goalService: () => mockGoalService,
  issueApprovalService: () => mockIssueApprovalService,
  executionWorkspaceService: () => mockExecutionWorkspaceService,
  workProductService: () => mockWorkProductService,
  documentService: () => mockDocumentService,
  routineService: () => mockRoutineService,
  logActivity: mockLogActivity,
}));

vi.mock("../services/issue-assignment-wakeup.js", () => ({
  queueIssueAssignmentWakeup: vi.fn(),
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: validAgentId,
      companyId,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("GET /api/companies/:companyId/issues — UUID filter validation (POLAAA-35)", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 400 for short assigneeAgentId (e.g. dbc9e430)", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?assigneeAgentId=dbc9e430`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assigneeAgentId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for short assigneeAgentId (8-char prefix only, e.g. 972002ec)", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?assigneeAgentId=972002ec`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assigneeAgentId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed participantAgentId", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?participantAgentId=not-a-uuid`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/participantAgentId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed projectId", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?projectId=abc123`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/projectId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed parentId", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?parentId=bad`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parentId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed labelId", async () => {
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?labelId=xyz`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/labelId/);
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("passes through and calls svc.list for a valid assigneeAgentId UUID", async () => {
    mockIssueService.list.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues?assigneeAgentId=${validAgentId}`);
    expect(res.status).toBe(200);
    expect(mockIssueService.list).toHaveBeenCalledOnce();
  });

  it("passes through with no UUID filters", async () => {
    mockIssueService.list.mockResolvedValue([]);
    const res = await request(app)
      .get(`/api/companies/${companyId}/issues`);
    expect(res.status).toBe(200);
    expect(mockIssueService.list).toHaveBeenCalledOnce();
  });
});
