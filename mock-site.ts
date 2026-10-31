import express, { Express, Request, Response } from 'express';

// ============================================================================
// Type Definitions
// ============================================================================

interface Flight {
  from: string;
  to: string;
  date?: string;
  price: number;
  time: string;
  stops: number;
}

interface SearchRequest {
  from: string;
  to: string;
  date: string;
}

interface BookingRequest {
  flight: Flight;
  email: string;
  card: string;
}

export interface Order {
  confirmationNumber: string;
  flight: Flight;
  email: string;
  card: string;
  timestamp: Date;
  charged: number;
  status?: 'confirmed' | 'cancelled' | 'active';
}

interface BookingResponse {
  success: boolean;
  confirmationNumber?: string;
  flight?: Flight;
  email?: string;
  error?: string;
}

// ============================================================================
// Application Setup
// ============================================================================

const app: Express = express();
const orders: Order[] = [];

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Routes
// ============================================================================

// Serve the HTML form
app.get('/', (_req: Request, res: Response): void => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mock Flight Booking</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        input, select { padding: 8px; margin: 5px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .search-results { margin-top: 20px; }
        .flight { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
        .confirmation { background: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Flight Booking System</h1>
      
      <form id="searchForm">
        <h2>Search Flights</h2>
        <input type="text" id="from" placeholder="From (e.g., NYC)" required>
        <input type="text" id="to" placeholder="To (e.g., LAX)" required>
        <input type="date" id="date" required>
        <button type="submit">Search</button>
      </form>

      <div id="results" class="search-results"></div>

      <div id="checkout" style="display:none; border: 1px solid #ddd; padding: 15px; margin-top: 20px;">
        <h2>Checkout</h2>
        <input type="email" id="email" placeholder="Email" required>
        <input type="text" id="card" placeholder="Card (4111...)" required>
        <button type="button" onclick="pay()">Pay Now</button>
      </div>

      <div id="confirmation"></div>

      <div id="bookings" style="display:none; border: 1px solid #f8d7da; padding: 15px; margin-top: 20px;">
        <h2>Your Bookings</h2>
        <div id="bookingsList"></div>
      </div>

      <script>
        let selectedFlight = null;

        document.getElementById('searchForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const from = document.getElementById('from').value;
          const to = document.getElementById('to').value;
          const date = document.getElementById('date').value;

          const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, date })
          });
          const flights = await res.json();

          let html = '<h3>Results:</h3>';
          flights.forEach(f => {
            html += \`
              <div class="flight">
                <strong>\${f.from} → \${f.to}</strong> | $\${f.price} | \${f.time}
                <button onclick="selectFlight(\${JSON.stringify(f).replace(/"/g, '&quot;')})">
                  Select & Checkout
                </button>
              </div>
            \`;
          });
          document.getElementById('results').innerHTML = html;
        });

        function selectFlight(flight) {
          selectedFlight = flight;
          document.getElementById('checkout').style.display = 'block';
        }

        async function pay() {
          const email = document.getElementById('email').value;
          const card = document.getElementById('card').value;

          const res = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flight: selectedFlight,
              email,
              card
            })
          });

          const result = await res.json();
          
          if (result.success) {
            document.getElementById('confirmation').innerHTML = \`
              <div class="confirmation" data-testid="confirmation-number">
                <h2>✅ Booking Confirmed!</h2>
                <p><strong>Confirmation #:</strong> \${result.confirmationNumber}</p>
                <p><strong>Flight:</strong> \${result.flight.from} → \${result.flight.to}</p>
                <p><strong>Price:</strong> $\${result.flight.price}</p>
                <p><strong>Email:</strong> \${result.email}</p>
              </div>
            \`;
            document.getElementById('checkout').style.display = 'none';
            showBookings(email);
          } else {
            alert('Booking failed: ' + result.error);
          }
        }

        async function showBookings(email) {
          const res = await fetch('/api/orders?email=' + encodeURIComponent(email));
          const userOrders = await res.json();
          
          if (userOrders.length > 0) {
            document.getElementById('bookings').style.display = 'block';
            let html = '';
            userOrders.forEach((order, idx) => {
              html += \`
                <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
                  <p><strong>\${order.flight.from} → \${order.flight.to}</strong> | $\${order.flight.price}</p>
                  <p>Status: \${order.status || 'confirmed'}</p>
                  <button onclick="cancelBooking('\${order.confirmationNumber}')" style="background: #dc3545;">Cancel</button>
                </div>
              \`;
            });
            document.getElementById('bookingsList').innerHTML = html;
          }
        }

        async function cancelBooking(confirmationNumber) {
          if (!confirm('Are you sure you want to cancel this booking?')) return;
          
          const res = await fetch('/api/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmationNumber })
          });
          
          const result = await res.json();
          if (result.success) {
            alert('Booking cancelled successfully');
            const email = document.getElementById('email').value;
            if (email) showBookings(email);
          } else {
            alert('Cancellation failed: ' + result.error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Search endpoint
// BUG #1: 20% of the time, returns flights to a different destination
app.post('/api/search', (req: Request, res: Response): void => {
  const { from, to, date } = req.body as SearchRequest;

  const isBuggy = Math.random() < 0.2;

  const flights: Flight[] = [
    { from, to: isBuggy ? 'WRONG' : to, date, price: 150, time: '10:00 AM', stops: 0 },
    { from, to: isBuggy ? 'WRONG' : to, date, price: 120, time: '2:00 PM', stops: 0 },
    { from, to: isBuggy ? 'WRONG' : to, date, price: 200, time: '6:00 PM', stops: 1 },
  ];

  res.json(flights);
});

// Booking endpoint
// BUG #2: 10% of the time, double-charges (simulates race condition)
app.post('/api/book', (req: Request, res: Response): void => {
  const { flight, email, card } = req.body as BookingRequest;

  const shouldDoubleCharge = Math.random() < 0.1;

  const confirmationNumber = 'BOOK-' + Math.random().toString(36).substring(7).toUpperCase();

  const order: Order = {
    confirmationNumber,
    flight,
    email,
    card: card.substring(0, 4) + '****',
    timestamp: new Date(),
    charged: 1,
    status: 'confirmed',
  };

  // If double-charge bug triggers, add a duplicate order
  if (shouldDoubleCharge) {
    const duplicate: Order = JSON.parse(JSON.stringify(order));
    duplicate.confirmationNumber = 'BOOK-' + Math.random().toString(36).substring(7).toUpperCase();
    orders.push(duplicate);
    order.charged = 2; // Flag as buggy
  }

  orders.push(order);

  const response: BookingResponse = {
    success: true,
    confirmationNumber,
    flight,
    email,
  };

  res.json(response);
});

// API to check orders (for test assertions)
app.get('/api/orders', (req: Request, res: Response): void => {
  const email = req.query.email as string | undefined;
  const userOrders = email ? orders.filter((o) => o.email === email) : orders;
  res.json(userOrders);
});

// API to cancel a booking
app.post('/api/cancel', (req: Request, res: Response): void => {
  const { confirmationNumber } = req.body as { confirmationNumber: string };

  const order = orders.find((o) => o.confirmationNumber === confirmationNumber);
  if (!order) {
    res.json({ success: false, error: 'Booking not found' });
    return;
  }

  order.status = 'cancelled';
  res.json({ success: true, message: 'Booking cancelled' });
});

// API to reset state between trials
app.post('/api/reset', (_req: Request, res: Response): void => {
  orders.length = 0;
  res.json({ ok: true, message: 'Orders cleared' });
});

// ============================================================================
// Server Start
// ============================================================================

const PORT = 3000;

app.listen(PORT, (): void => {
  console.log(`✅ Mock flight booking site running at http://localhost:${PORT}`);
  console.log('');
  console.log('Intentional bugs for testing:');
  console.log('  🐛 BUG #1: 20% of searches return wrong destination');
  console.log('  🐛 BUG #2: 10% of bookings double-charge');
  console.log('');
});

export default app;
