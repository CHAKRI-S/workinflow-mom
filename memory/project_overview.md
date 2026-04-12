---
name: WorkinFlow MOM Project Overview
description: WorkinFlow MOM - Manufacturing Operations Management for CNC automotive parts machining factory
type: project
---

WorkinFlow MOM is a Manufacturing Operations Management system for a **CNC machining factory** that produces **automotive parts**.

**Tech Stack:** Next.js 16 (App Router) + Prisma 7 + PostgreSQL 16 + Tailwind CSS 4 + shadcn/ui v4

**Deployment plan:** Docker for dev, Coolify for production (future)

**Actual Business Flow:**
1. Receive customer inquiry → Create Quotation
2. Customer approves → Check order details (qty, color, Fusion 360 design file name)
3. Open design → Check material dimensions → Order materials from supplier (via LINE)
4. Order additional components (nuts, screws, etc.)
5. Production planning → Assign CNC machine (type, material size, qty) → Notify workers
6. CNC production with clear timeline tracking
7. QC #1 (post-machining)
8. Send to external painting factory (if painting required)
9. Receive back → CNC logo engraving (two-tone color)
10. QC #2 (post-engraving)
11. Count + pack
12. Customer payment → Ship

**Key characteristics:**
- Works with Fusion 360 CAD designs
- CNC machines of different types
- Outsourced painting (send out and receive back)
- Two-tone logo engraving step
- Two QC checkpoints
- Payment tracking before shipping
- Supplier communication currently via LINE

**Why:** User wants to digitize and manage their entire manufacturing workflow from quotation to delivery.

**How to apply:** All module design should match the CNC automotive parts workflow above. Include quotation management, Fusion 360 file references, CNC machine assignment, outsource tracking (painting), and payment status before shipping.
