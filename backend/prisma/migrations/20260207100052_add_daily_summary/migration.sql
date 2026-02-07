-- CreateTable
CREATE TABLE "DailySummary" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "inTime" BIGINT,
    "outTime" BIGINT,
    "workedMs" BIGINT,
    "updatedAt" DATETIME NOT NULL
);
