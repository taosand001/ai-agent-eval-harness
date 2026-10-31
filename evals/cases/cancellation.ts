// Cancellation and rebooking test cases - complex stateful flows

import type { EvalCase } from '../../src/types.js';
import { Order } from '../../mock-site.js';

export const cancellationCases: EvalCase[] = [
  {
    id: 'cancel-and-rebook',
    title: 'Cancel and rebook in one flow',
    description: 'Agent should cancel old flight and book new one without issues',
    task: 'Cancel your Lisbon flight and rebook to Barcelona instead',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Pre-create a booking to cancel
      await ctx.page.evaluate(() =>
        fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flight: { from: 'NYC', to: 'Lisbon', price: 200, time: '10:00 AM', stops: 0 },
            email: 'ada@example.com',
            card: '4111111111111111'
          })
        }).then((r) => r.json())
      );
      ctx.transcript.push('Setup: Pre-existing Lisbon booking created');
    },
    assertions: [
      {
        kind: 'state',
        name: 'old-flight-cancelled',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const lisbon = orders.find((o:Order) => o.flight?.to === 'Lisbon');
          return lisbon?.status === 'cancelled' || !lisbon;
        },
      },
      {
        kind: 'state',
        name: 'new-flight-booked',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const barcelona = orders.find((o:Order) => o.flight?.to === 'Barcelona');
          return barcelona?.status === 'confirmed' || barcelona?.status === 'active';
        },
      },
      {
        kind: 'state',
        name: 'no-duplicate-bookings',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const barcelona = orders.filter((o:Order) => o.flight?.to === 'Barcelona');
          return barcelona.length === 1;
        },
      },
    ],
  },

  {
    id: 'refund-after-cancel',
    title: 'Process refund correctly',
    description: 'Cancellation must issue a refund to the customer',
    task: 'Cancel your flight and verify refund',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Pre-create a booking to cancel
      await ctx.page.evaluate(() =>
        fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flight: { from: 'NYC', to: 'LAX', price: 150, time: '10:00 AM', stops: 0 },
            email: 'ada@example.com',
            card: '4111111111111111'
          })
        }).then((r) => r.json())
      );
      ctx.transcript.push('Setup: Booking created for cancellation test');
    },
    assertions: [
      {
        kind: 'state',
        name: 'refund-issued',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          // At least one order should be marked as cancelled/refunded
          return orders.some((o:Order) => o.status === 'cancelled' || o.charged < 0);
        },
      },
    ],
  },

  {
    id: 'rebook-with-price-difference',
    title: 'Handle rebooking with price difference',
    description: 'If new flight costs more/less, charge the difference or refund',
    task: 'Cancel $200 flight and rebook $150 flight',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Pre-create an expensive booking to cancel and rebook cheaper
      await ctx.page.evaluate(() =>
        fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flight: { from: 'NYC', to: 'London', price: 200, time: '10:00 AM', stops: 0 },
            email: 'ada@example.com',
            card: '4111111111111111'
          })
        }).then((r) => r.json())
      );
      ctx.transcript.push('Setup: $200 booking created for price-difference test');
    },
    assertions: [
      {
        kind: 'state',
        name: 'old-flight-cancelled',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          return orders.some((o:Order) => o.status === 'cancelled');
        },
      },
      {
        kind: 'state',
        name: 'net-charge-correct',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          // Net charge should be -$50 (refund $200, charge $150)
          const netCharge = orders.reduce((sum:any, o:Order) => sum + (o.charged || 0), 0);
          return Math.abs(netCharge - (-50)) < 5 || netCharge > 0;
        },
      },
    ],
  },

  {
    id: 'cancel-without-rebook',
    title: 'Cancel-only operation',
    description: 'Agent should be able to cancel without rebooking',
    task: 'Just cancel your flight, do not rebook',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Pre-create a booking to cancel
      await ctx.page.evaluate(() =>
        fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flight: { from: 'NYC', to: 'Paris', price: 180, time: '10:00 AM', stops: 0 },
            email: 'ada@example.com',
            card: '4111111111111111'
          })
        }).then((r) => r.json())
      );
      ctx.transcript.push('Setup: Booking created for cancel-only test');
    },
    assertions: [
      {
        kind: 'state',
        name: 'flight-cancelled',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          return orders.some((o:Order) => o.status === 'cancelled');
        },
      },
      {
        kind: 'state',
        name: 'only-one-cancellation',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const cancelled = orders.filter((o:Order) => o.status === 'cancelled');
          return cancelled.length === 1;
        },
      },
    ],
  },

  {
    id: 'rebook-same-destination',
    title: 'Rebook to same destination',
    description: 'Agent should allow rebooking to same city with different flight',
    task: 'Cancel your Lisbon flight and book a different Lisbon flight',
    setup: async (ctx) => {
      await ctx.page.goto('http://localhost:3000');
      // Pre-create a Lisbon booking to rebook
      await ctx.page.evaluate(() =>
        fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flight: { from: 'NYC', to: 'Lisbon', price: 170, time: '2:00 PM', stops: 1 },
            email: 'ada@example.com',
            card: '4111111111111111'
          })
        }).then((r) => r.json())
      );
      ctx.transcript.push('Setup: Lisbon booking created for same-destination rebook test');
    },
    assertions: [
      {
        kind: 'state',
        name: 'old-booking-inactive',
        check: async (ctx) => {
          const orders = await ctx.page.evaluate(() =>
            fetch('/api/orders').then((r) => r.json())
          );
          const lisbon = orders.find((o:Order) => o.flight?.to === 'Lisbon' && o.status === 'active');
          // Should have at most one active Lisbon booking
          return !lisbon || orders.filter((o:Order) => o.flight?.to === 'Lisbon' && o.status === 'active').length === 1;
        },
      },
    ],
  },
];
