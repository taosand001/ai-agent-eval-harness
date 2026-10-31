// A fake flight booking website
// Intentionally has bugs so you can test your agent harness against them

const express = require('express');
const app = express();

let orders = []; // In-memory database

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the HTML form
app.get('/', (req, res) => {
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
                <strong>\${f.from} → \${f.to}</strong> | \${f.price} | \${f.time}
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
                <p><strong>Price:</strong> \$\${result.flight.price}</p>
                <p><strong>Email:</strong> \${result.email}</p>
              </div>
            \`;
            document.getElementById('checkout').style.display = 'none';
          } else {
            alert('Booking failed: ' + result.error);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Search endpoint
app.post('/api/search', (req, res) => {
  const { from, to, date } = req.body;

  // BUG #1: Sometimes returns wrong results
  // 20% of the time, returns a flight to a different destination
  const isBuggy = Math.random() < 0.2;

  const flights = [
    { from, to: isBuggy ? 'WRONG' : to, price: 150, time: '10:00 AM', stops: 0 },
    { from, to: isBuggy ? 'WRONG' : to, price: 120, time: '2:00 PM', stops: 0 },
    { from, to: isBuggy ? 'WRONG' : to, price: 200, time: '6:00 PM', stops: 1 },
  ];

  res.json(flights);
});

// Booking endpoint
app.post('/api/book', (req, res) => {
  const { flight, email, card } = req.body;

  // BUG #2: Sometimes double-charges (race condition simulation)
  // 10% of the time, process the payment twice
  const shouldDoubleCharge = Math.random() < 0.1;

  const confirmationNumber = 'BOOK-' + Math.random().toString(36).substring(7).toUpperCase();

  const order = {
    confirmationNumber,
    flight,
    email,
    card: card.substring(0, 4) + '****',
    timestamp: new Date(),
    charged: 1
  };

  // If double-charge bug triggers, charge twice
  if (shouldDoubleCharge) {
    const duplicate = JSON.parse(JSON.stringify(order));
    duplicate.confirmationNumber = 'BOOK-' + Math.random().toString(36).substring(7).toUpperCase();
    orders.push(duplicate);
    order.charged = 2; // Flag as buggy
  }

  orders.push(order);

  res.json({
    success: true,
    confirmationNumber,
    flight,
    email
  });
});

// API to check orders (for test assertions)
app.get('/api/orders', (req, res) => {
  const email = req.query.email;
  const userOrders = email ? orders.filter(o => o.email === email) : orders;
  res.json(userOrders);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Mock flight booking site running at http://localhost:${PORT}`);
  console.log('Contains intentional bugs for testing:');
  console.log('  BUG #1: 20% of searches return wrong destination');
  console.log('  BUG #2: 10% of bookings double-charge');
});
