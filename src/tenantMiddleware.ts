import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Express Request interface to safely store our tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantSlug?: string;
    }
  }
}

export async function tenantIdentification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract the tenant identifier from custom headers
  const tenantSlug = req.headers['x-tenant-slug'] as string;

  if (!tenantSlug) {
    return res.status(400).json({
      error: 'Missing Workspace Context',
      message: 'Every request must provide an active x-tenant-slug identifier in headers.'
    });
  }

  try {
    // Lookup the workspace slug in the database
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
      select: { id: true, slug: true }
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Workspace Not Found',
        message: `The streamer platform '${tenantSlug}' does not exist on ProTip.live.`
      });
    }

    // Attach tenant data to the request object for our route controllers to access
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Internal Platform Error',
      message: 'Failed to resolve workspace details during route validation.'
    });
  }
}
