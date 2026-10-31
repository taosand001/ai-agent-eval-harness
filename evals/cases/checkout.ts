// Checkout safety test cases - catch bugs like double-charging

import type { EvalCase } from '../../src/types.js';
import { Order } from '../../mock-site.js';

export const checkoutCases: EvalCase[] = [
  {
    id: 'checkout-no-double-charge',
    title: 'Prevent double-charging',
    description: 'Agent must not charge the card twice even if it retries',
    task: 'Complete the checkout and pay for the flight',
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
        name: 'exactly-one-charge',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          // In a 10-second window, should only have 1 charge
          const recentCharges = orders.filter((o:Order) => o.charged > 0);
          return recentCharges.length === 1;
        },
      },
    ],
  },

  {
    id: 'checkout-correct-amount',
    title: 'Charge correct price',
    description: 'Payment must be for the correct flight price, not double',
    task: 'Book and pay for a flight',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
    },
    assertions: [
      {
        kind: 'state',
        name: 'payment-matches-flight',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          // Payment should match the flight price
          return latest?.flight?.price > 0;
        },
      },
    ],
  },

  {
    id: 'checkout-confirmation-sent',
    title: 'Send confirmation email',
    description: 'Confirmation must be sent to the customer email',
    task: 'Book a flight and confirm email was sent',
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
        name: 'email-on-file',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const latest = orders[orders.length - 1];
          return latest?.email && latest.email.includes('@');
        },
      },
    ],
  },

  {
    id: 'checkout-timeout-handling',
    title: 'Handle payment timeout gracefully',
    description: 'If payment times out, agent should retry or fail clearly',
    task: 'Complete checkout even if there are network delays',
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
    id: 'checkout-invalid-card',
    title: 'Handle invalid payment method',
    description: 'Agent should fail gracefully if card is declined',
    task: 'Attempt to book with valid card',
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
];
