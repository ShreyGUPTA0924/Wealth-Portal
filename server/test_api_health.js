const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://127.0.0.1:8000/ai/health-score', {
      portfolio: {
        holdings: [
          {
            id: '900001c1-e61c-4cf0-8ec1-aa1c7523050e',
            assetClass: 'STOCK',
            name: 'OLA',
            pnlPercent: -26.102,
            currentValue: 1738
          }
        ],
        currentValue: 100000,
        allocation: [
          { assetClass: 'STOCK', currentValue: 1738 }
        ]
      },
      goals: [],
      checklist_history: []
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
test();
