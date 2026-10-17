import { Prisma } from "@prisma/client";

/**
 * Bookings are soft-deleted (deletedAt set by an ADMIN). Every top-level read of a booking model
 * gets `deletedAt: null` added automatically, so a deleted booking disappears from the dashboard,
 * lists, reports, conflict checks and detail pages without each query having to remember it.
 *
 * To read deleted rows on purpose, put any `deletedAt` condition in the where clause yourself
 * (e.g. `{ deletedAt: { not: null } }`) — an explicit condition is left untouched.
 *
 * Not covered: nested relation includes (e.g. banquet.linkedAccommodations) — soft delete
 * disconnects those links instead — and paymentEntry queries, which filter by relation where needed.
 */
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

function excludeDeleted<A>(operation: string, args: A): A {
  if (!READ_OPERATIONS.has(operation)) return args;
  const a = (args ?? {}) as { where?: Record<string, unknown> };
  if (a.where && "deletedAt" in a.where) return args;
  return { ...a, where: { ...(a.where ?? {}), deletedAt: null } } as A;
}

export const softDeleteBookings = Prisma.defineExtension({
  name: "soft-delete-bookings",
  query: {
    accommodationBooking: {
      $allOperations({ operation, args, query }) {
        return query(excludeDeleted(operation, args));
      },
    },
    banquetBooking: {
      $allOperations({ operation, args, query }) {
        return query(excludeDeleted(operation, args));
      },
    },
  },
});

