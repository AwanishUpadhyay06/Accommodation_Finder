const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Property = require('./models/Property');
const User = require('./models/User');

async function debugPropertyCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if we have any owners in the database
    const owners = await User.find({ role: 'owner' });
    console.log(`\n📊 Found ${owners.length} owner(s) in database:`);
    owners.forEach((owner, index) => {
      console.log(`${index + 1}. ${owner.name} (${owner.email}) - ID: ${owner._id}`);
    });

    if (owners.length === 0) {
      console.log('❌ No owners found! This could be the issue.');
      return;
    }

    // Test property creation with sample data
    const testOwner = owners[0];
    console.log(`\n🧪 Testing property creation with owner: ${testOwner.name}`);

    const testPropertyData = {
      title: 'Debug Test Property',
      description: 'This is a test property created for debugging purposes to identify server errors.',
      price: 1200,
      location: {
        address: '123 Debug Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '12345'
      },
      propertyType: '2BHK',
      area: 1000,
      bedrooms: 2,
      bathrooms: 2,
      bachelorsAllowed: true,
      furnishingStatus: 'Half',
      features: ['WiFi', 'Parking'],
      facilities: ['Gym', 'Swimming Pool'],
      availability: 'Available',
      owner: testOwner._id
    };

    console.log('\n📝 Test property data:');
    console.log(JSON.stringify(testPropertyData, null, 2));

    // Try to create the property
    console.log('\n🔄 Attempting to create property...');
    const property = new Property(testPropertyData);
    
    // Validate the property before saving
    const validationError = property.validateSync();
    if (validationError) {
      console.log('❌ Validation Error:', validationError.message);
      console.log('Validation Details:', validationError.errors);
      return;
    }

    console.log('✅ Property validation passed');

    // Try to save
    await property.save();
    console.log('✅ Property created successfully!');
    console.log('Property ID:', property._id);

    // Clean up - remove the test property
    await Property.findByIdAndDelete(property._id);
    console.log('🧹 Test property cleaned up');

  } catch (error) {
    console.error('❌ Error during property creation test:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    
    if (error.name === 'MongoServerError') {
      console.error('MongoDB error code:', error.code);
      console.error('MongoDB error details:', error.keyPattern);
    }
    
    console.error('Full error stack:', error.stack);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the debug script
debugPropertyCreation();
