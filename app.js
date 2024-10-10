const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const Twilio = require('twilio');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Database setup
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run('CREATE TABLE caregiver (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT)');
  db.run('CREATE TABLE health_data (id INTEGER PRIMARY KEY AUTOINCREMENT, caregiver_id INTEGER, pulse INTEGER, blood_pressure INTEGER, FOREIGN KEY(caregiver_id) REFERENCES caregiver(id))');
});

// Twilio setup
const accountSid = 'xxxxxxxxxxxxxxxxxxxxxxx'; // Use your Twilio account SID
const authToken = 'xxxxxxxxxxxxxxxxxxxx'; // Use your Twilio auth token
const client = new Twilio(accountSid, authToken);

// Register a caregiver
app.post('/register', (req, res) => {
  const { name, phone } = req.body;
  db.run('INSERT INTO caregiver (name, phone) VALUES (?, ?)', [name, phone], function(err) {
    if (err) {
      return res.status(500).send('Error registering caregiver');
    }
    res.status(201).send({ caregiverId: this.lastID });
  });
});

// Health data entry
app.post('/health-data', (req, res) => {
  const { caregiverId, pulse, bloodPressure } = req.body;

  // Insert health data
  db.run('INSERT INTO health_data (caregiver_id, pulse, blood_pressure) VALUES (?, ?, ?)', [caregiverId, pulse, bloodPressure], function(err) {
    if (err) {
      return res.status(500).send('Error inserting health data');
    }

    // Trigger alert if vital signs are abnormal
    if (pulse < 60 || pulse > 100 || bloodPressure < 90 || bloodPressure > 140) {
      db.get('SELECT phone FROM caregiver WHERE id = ?', [caregiverId], (err, row) => {
        if (row) {
          client.messages.create({
            body: `Alert! Abnormal health data detected. Pulse: ${pulse}, Blood Pressure: ${bloodPressure}`,
            from: 'whatsapp:+14155238886', // Use your Twilio WhatsApp number
            to: `whatsapp:${row.phone}`
          }).then(message => console.log(message.sid));
        }
      });
    }
    
    res.status(201).send('Health data recorded');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
