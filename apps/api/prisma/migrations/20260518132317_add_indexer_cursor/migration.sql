-- CreateTable
CREATE TABLE "IndexerCursor" (
    "name" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("name")
);
