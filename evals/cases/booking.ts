// Flight booking test cases

import type { EvalCase } from '../../src/types.ts';
import type { Order } from '../../mock-site.ts';

export const bookingCases: EvalCase[] = [
  {
    id: 'booking-happy-path',
    title: 'Book cheapest direct flight',
    description: 'User should be able to search and book the cheapest direct flight',
    task: 'Book the cheapest direct flight from NYC to LAX for tomorrow',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      ctx.transcript.push('Navigated to booking site');
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-testid="confirmation-number"]',
        expect: 'present',
        timeoutMs: 10000,
      },
      {
        kind: 'state',
        name: 'order-created',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          return Array.isArray(orders) && orders.length > 0;
        },
      },
      {
        kind: 'state',
        name: 'correct-destination',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          return latest?.flight?.to === 'LAX';
        },
      },
      {
        kind: 'state',
        name: 'is-direct-flight',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          return latest?.flight?.stops === 0;
        },
      },
      {
        kind: 'state',
        name: 'payment-processed',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          return orders.some((o: Order) => o.charged > 0);
        },
      },
    ],
  },

  {
    id: 'booking-with-connections',
    title: 'Handle connecting flights',
    description: 'Agent should understand connecting flights and still book correctly',
    task: 'Book a flight from NYC to LAX, price under $300',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-testid="confirmation-number"]',
        expect: 'present',
      },
      {
        kind: 'state',
        name: 'under-budget',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          return latest?.flight?.price <= 300;
        },
      },
    ],
  },

  {
    id: 'booking-error-recovery',
    title: 'Recover from search errors',
    description: 'Agent should handle empty results and retry',
    task: 'Find and book a flight from NYC to LAX',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-testid="confirmation-number"]',
        expect: 'present',
      },
    ],
  },

  {
    id: 'booking-multiple-options',
    title: 'Compare multiple flights',
    description: 'Agent should compare options and pick the best one',
    task: 'Book the best value flight (lowest price, direct)',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-testid="confirmation-number"]',
        expect: 'present',
      },
      {
        kind: 'state',
        name: 'best-value',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          // Best value: direct flight with lowest price
          return latest?.flight?.stops === 0 && latest?.flight?.price <= 150;
        },
      },
    ],
  },

  {
    id: 'booking-correct-date',
    title: 'Book for correct date',
    description: 'Agent must book for the exact date requested',
    task: 'Book a flight for tomorrow, not today or next week',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
    },
    assertions: [
      {
        kind: 'dom',
        locator: '[data-testid="confirmation-number"]',
        expect: 'present',
      },
      {
        kind: 'state',
        name: 'tomorrow-flight',
        check: async (ctx) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const expectedDate = tomorrow.toISOString().split('T')[0];

          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          return latest?.flight?.date === expectedDate;
        },
      },
    ],
  },
];
