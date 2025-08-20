const axios = require('axios');

async function testPropertyCreation() {
  try {
    console.log('🧪 Testing property creation with simple data...\n');

    // Use a simple test property that should work
    const propertyData = {
      title: 'Simple Test Property',
      description: 'This is a simple test property to identify server errors.',
      price: 1000,
      location: {
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State'
      },
      propertyType: '1BHK',
      area: 500,
      bedrooms: 1,
      bathrooms: 1,
      bachelorsAllowed: false,
      furnishingStatus: 'None',
      features: [],
      facilities: []
    };

    console.log('Property data:');
    console.log(JSON.stringify(propertyData, null, 2));

    // Test without authentication first to see what happens
    console.log('\n🔄 Testing property creation without authentication...');
    
    const response = await axios.post('http://localhost:5000/api/properties', propertyData, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on error status codes
    });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testPropertyCreation();
