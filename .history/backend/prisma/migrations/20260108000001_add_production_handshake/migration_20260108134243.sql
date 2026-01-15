-- CreateEnum
CREATE TYPE "PendingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PendingChangePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CHANGE_REQUEST', 'CHANGE_APPROVED', 'CHANGE_REJECTED');

-- CreateTable
CREATE TABLE "PendingChanges" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,
    "originalData" JSONB NOT NULL,
    "status" "PendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "priority" "PendingChangePriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingChanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingChanges_organizationId_idx" ON "PendingChanges"("organizationId");

-- CreateIndex
CREATE INDEX "PendingChanges_status_idx" ON "PendingChanges"("status");

-- CreateIndex
CREATE INDEX "PendingChanges_orderId_idx" ON "PendingChanges"("orderId");

-- CreateIndex
CREATE INDEX "PendingChanges_requestedBy_idx" ON "PendingChanges"("requestedBy");

-- CreateIndex
CREATE INDEX "PendingChanges_createdAt_idx" ON "PendingChanges"("createdAt");

-- CreateIndex
CREATE INDEX "Notifications_organizationId_idx" ON "Notifications"("organizationId");

-- CreateIndex
CREATE INDEX "Notifications_userId_idx" ON "Notifications"("userId");

-- CreateIndex
CREATE INDEX "Notifications_read_idx" ON "Notifications"("read");

-- CreateIndex
CREATE INDEX "Notifications_createdAt_idx" ON "Notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "PendingChanges" ADD CONSTRAINT "PendingChanges_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingChanges" ADD CONSTRAINT "PendingChanges_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingChanges" ADD CONSTRAINT "PendingChanges_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingChanges" ADD CONSTRAINT "PendingChanges_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;