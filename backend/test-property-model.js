const mongoose = require('mongoose');
require('dotenv').config();

// Import the Property model
const Property = require('./models/Property');

async function testPropertyModel() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test creating a simple property
    const testPropertyData = {
      title: 'Model Test Property',
      description: 'This is a test property to verify the Property model is working correctly.',
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
      facilities: [],
      owner: new mongoose.Types.ObjectId('688e5c3b62adfed1e9f7a07b') // Your user ID
    };

    console.log('\n🧪 Testing Property model...');
    console.log('Test data:', JSON.stringify(testPropertyData, null, 2));

    // Create property instance
    const property = new Property(testPropertyData);
    console.log('✅ Property instance created');

    // Validate synchronously
    const validationError = property.validateSync();
    if (validationError) {
      console.log('❌ Validation Error:', validationError.message);
      console.log('Validation Details:');
      Object.keys(validationError.errors).forEach(key => {
        console.log(`  - ${key}: ${validationError.errors[key].message}`);
        console.log(`    Value: ${validationError.errors[key].value}`);
        console.log(`    Kind: ${validationError.errors[key].kind}`);
      });
      return;
    }
    console.log('✅ Validation passed');

    // Try to save
    await property.save();
    console.log('✅ Property saved successfully with ID:', property._id);

    // Clean up
    await Property.findByIdAndDelete(property._id);
    console.log('🧹 Test property cleaned up');

    console.log('\n🎉 Property model test PASSED - model is working correctly');

  } catch (error) {
    console.error('\n❌ Property model test FAILED');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the test
testPropertyModel();
