import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  getAttachmentById: vi.fn(),
  getComment: vi.fn(),
  getLabelById: vi.fn(),
  list: vi.fn(),
  listComments: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  unlink: vi.fn(),
}));

const mockWorkProductService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => ({
    wakeup: vi.fn(),
    reportRunActivity: vi.fn(),
  }),
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: vi.fn(),
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(),
  }),
  workProductService: () => mockWorkProductService,
}));

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

describe("issue list route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
    });
    mockIssueService.getByIdentifier.mockResolvedValue(null);
    mockIssueService.getAttachmentById.mockResolvedValue(null);
    mockIssueService.getComment.mockResolvedValue(null);
    mockIssueService.getLabelById.mockResolvedValue(null);
    mockIssueService.list.mockResolvedValue([]);
    mockIssueService.listComments.mockResolvedValue([]);
    mockIssueApprovalService.unlink.mockResolvedValue(undefined);
    mockWorkProductService.getById.mockResolvedValue(null);
  });

  it("rejects malformed assigneeAgentId filters before hitting the issues service", async () => {
    const res = await request(createApp())
      .get("/api/companies/company-1/issues")
      .query({ assigneeAgentId: "dbc9e430", status: "in_progress,todo" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid assigneeAgentId. Expected UUID.",
    });
    expect(mockIssueService.list).not.toHaveBeenCalled();
  });

  it("rejects malformed afterCommentId cursors before listing comments", async () => {
    const res = await request(createApp())
      .get("/api/issues/issue-1/comments")
      .query({ afterCommentId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid afterCommentId. Expected UUID.",
    });
    expect(mockIssueService.listComments).not.toHaveBeenCalled();
  });

  it("rejects malformed comment path ids before loading a single comment", async () => {
    const res = await request(createApp()).get("/api/issues/issue-1/comments/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid commentId. Expected UUID.",
    });
    expect(mockIssueService.getComment).not.toHaveBeenCalled();
  });

  it("rejects malformed wakeCommentId cursors before building heartbeat context", async () => {
    const res = await request(createApp())
      .get("/api/issues/issue-1/heartbeat-context")
      .query({ wakeCommentId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid wakeCommentId. Expected UUID.",
    });
    expect(mockIssueService.getComment).not.toHaveBeenCalled();
  });

  it("rejects malformed approval ids before unlinking an approval", async () => {
    const res = await request(createApp()).delete("/api/issues/issue-1/approvals/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid approvalId. Expected UUID.",
    });
    expect(mockIssueApprovalService.unlink).not.toHaveBeenCalled();
  });

  it("rejects malformed work product ids before looking them up", async () => {
    const res = await request(createApp()).delete("/api/work-products/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid workProductId. Expected UUID.",
    });
    expect(mockWorkProductService.getById).not.toHaveBeenCalled();
  });

  it("rejects malformed attachment ids before loading attachment content", async () => {
    const res = await request(createApp()).get("/api/attachments/not-a-uuid/content");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid attachmentId. Expected UUID.",
    });
    expect(mockIssueService.getAttachmentById).not.toHaveBeenCalled();
  });

  it("rejects malformed label ids before looking up a label", async () => {
    const res = await request(createApp()).delete("/api/labels/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid labelId. Expected UUID.",
    });
    expect(mockIssueService.getLabelById).not.toHaveBeenCalled();
  });
});
