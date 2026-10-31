import type { RunContext } from '../types.js';

/**
 * Scripted agent: deterministic, no API key required, reproducible.
 * Handles booking, cancellation, and rebooking flows based on task description.
 */
export async function scripted(ctx: RunContext, task: string): Promise<void> {
  const { page } = ctx;

  try {
    // Detect task type from task description
    const taskLower = task.toLowerCase();

    if (taskLower.includes('cancel')) {
      // Handle cancellation flows
      await handleCancellation(page, task);
    } else if (taskLower.includes('rebook') && !taskLower.includes('cancel')) {
      // Handle rebooking flows (but not if it's cancel+rebook, that's handleCancellation)
      await handleRebooking(page, task);
    } else {
      // Default: booking flow
      await handleBooking(page, task);
    }

    ctx.transcript.push(`Completed: ${task}`);
  } catch (error) {
    ctx.transcript.push(`Task failed: ${String(error).slice(0, 150)}`);
    throw error;
  }
}

async function handleBooking(page: any, task: string): Promise<void> {
  // Extract destination from task if specified
  let destination = 'LAX';
  if (task.includes('Barcelona')) destination = 'Barcelona';
  else if (task.includes('Lisbon')) destination = 'Lisbon';
  else if (task.includes('London')) destination = 'London';
  else if (task.includes('Paris')) destination = 'Paris';

  // Fill search form
  await page.fill('#from', 'NYC');
  await page.fill('#to', destination);

  // Set date to tomorrow
  const tomorrow = new Date(Date.now() + 86400000);
  await page.fill('#date', tomorrow.toISOString().slice(0, 10));

  // Submit search
  await page.click('#searchForm button[type=submit]');
  await page.waitForSelector('.flight', { timeout: 5000 });

  // Select first flight
  await page.locator('.flight button').first().click();

  // Fill payment details
  await page.fill('#email', 'ada@example.com');
  await page.fill('#card', '4111111111111111');
  await page.click('button:has-text("Pay Now")');

  // Wait for confirmation
  await page.waitForSelector('[data-testid="confirmation-number"]', { timeout: 5000 });
}

async function handleCancellation(page: any, task: string): Promise<void> {
  const taskLower = task.toLowerCase();
  
  // Extract destination from task to find the specific order to cancel
  let cancelDestination = 'LAX'; // default
  if (taskLower.includes('lisbon')) cancelDestination = 'Lisbon';
  else if (taskLower.includes('barcelona')) cancelDestination = 'Barcelona';
  else if (taskLower.includes('london')) cancelDestination = 'London';
  else if (taskLower.includes('paris')) cancelDestination = 'Paris';
  
  // Get existing orders
  const existingOrders = await page.evaluate(() =>
    fetch('/api/orders').then((r) => r.json())
  );

  // Find the specific order to cancel by destination, or any active order
  let toCancel = existingOrders.find((o: any) => 
    (o.flight?.to === cancelDestination) && (o.status === 'confirmed' || o.status === 'active')
  );
  
  // Fallback: find any active order if specific destination not found
  if (!toCancel) {
    toCancel = existingOrders.find((o: any) => o.status === 'confirmed' || o.status === 'active');
  }
  
  if (!toCancel) {
    // No booking to cancel, which is an error for cancellation tasks
    throw new Error(`No active booking found to cancel (looking for ${cancelDestination})`);
  }

  // Cancel the booking via API
  const cancelResult = await page.evaluate((confirmNum: string) => {
    return fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationNumber: confirmNum })
    }).then((r) => r.json());
  }, toCancel.confirmationNumber);
  
  if (!cancelResult.success) {
    throw new Error(`Failed to cancel order: ${cancelResult.error}`);
  }

  // Check if we should rebook
  const shouldRebook = taskLower.includes('rebook') || taskLower.includes('book a different') || taskLower.includes('book a new');
  const shouldNotRebook = taskLower.includes('do not') && taskLower.includes('rebook');

  if (shouldRebook && !shouldNotRebook) {
    await page.waitForTimeout(300);
    
    // Determine rebooking destination
    // If task says "cancel X and rebook to Y", we need to extract Y
    let destination = 'Barcelona'; // default
    
    // Parse "instead" pattern: "cancel Lisbon and rebook to Barcelona instead"
    const insteadMatch = task.match(/instead\s+to\s+(\w+)/i) || task.match(/rebook\s+to\s+(\w+)/i);
    if (insteadMatch) {
      destination = insteadMatch[1];
    } else if (taskLower.includes('different')) {
      // For "book a different X" pattern
      if (taskLower.includes('barcelona')) destination = 'Barcelona';
      else if (taskLower.includes('lisbon')) destination = 'Lisbon';
      else if (taskLower.includes('london')) destination = 'London';
      else if (taskLower.includes('paris')) destination = 'Paris';
    }
    
    // Book the new flight
    await page.fill('#from', 'NYC');
    await page.fill('#to', destination);
    const tomorrow = new Date(Date.now() + 86400000);
    await page.fill('#date', tomorrow.toISOString().slice(0, 10));
    await page.click('#searchForm button[type=submit]');
    await page.waitForSelector('.flight', { timeout: 5000 });
    await page.locator('.flight button').first().click();
    await page.fill('#email', 'ada@example.com');
    await page.fill('#card', '4111111111111111');
    await page.click('button:has-text("Pay Now")');
    await page.waitForSelector('[data-testid="confirmation-number"]', { timeout: 5000 });
  }
}

async function handleRebooking(page: any, task: string): Promise<void> {
  // Extract new destination
  let newDestination = 'Barcelona';
  if (task.includes('Lisbon')) newDestination = 'Lisbon';
  else if (task.includes('London')) newDestination = 'London';
  else if (task.includes('Paris')) newDestination = 'Paris';

  // Get existing orders
  let existingOrders = await page.evaluate(() =>
    fetch('/api/orders').then((r) => r.json())
  );

  // Find an active order to cancel
  const toCancel = existingOrders.find((o: any) => o.status === 'confirmed' || o.status === 'active');

  if (toCancel) {
    // Cancel the existing booking
    await page.evaluate((confirmNum: string) => {
      return fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationNumber: confirmNum })
      }).then((r) => r.json());
    }, toCancel.confirmationNumber);
    
    await page.waitForTimeout(500);
  }

  // Book new flight to new destination
  await page.fill('#from', 'NYC');
  await page.fill('#to', newDestination);
  const tomorrow = new Date(Date.now() + 86400000);
  await page.fill('#date', tomorrow.toISOString().slice(0, 10));
  await page.click('#searchForm button[type=submit]');
  await page.waitForSelector('.flight', { timeout: 5000 });
  await page.locator('.flight button').first().click();
  await page.fill('#email', 'ada@example.com');
  await page.fill('#card', '4111111111111111');
  await page.click('button:has-text("Pay Now")');
  await page.waitForSelector('[data-testid="confirmation-number"]', { timeout: 5000 });
}
