const mongoose = require('mongoose');
require('dotenv').config();

const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');

const addSampleAnalyticsData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find existing properties and users
    const properties = await Property.find().limit(5);
    const users = await User.find({ role: 'tenant' }).limit(10);
    const owners = await User.find({ role: 'owner' }).limit(3);

    if (properties.length === 0 || users.length === 0) {
      console.log('No properties or users found. Please add some properties and users first.');
      return;
    }

    console.log(`Found ${properties.length} properties and ${users.length} tenant users`);

    // Add sample views to properties
    for (const property of properties) {
      const viewCount = Math.floor(Math.random() * 50) + 10; // 10-60 views
      const viewedBy = [];
      
      // Add some user views
      for (let i = 0; i < Math.min(viewCount, users.length); i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const viewDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
        
        viewedBy.push({
          user: randomUser._id,
          viewedAt: viewDate,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`
        });
      }

      // Add some anonymous views
      for (let i = 0; i < viewCount - viewedBy.length; i++) {
        const viewDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        viewedBy.push({
          viewedAt: viewDate,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`
        });
      }

      await Property.findByIdAndUpdate(property._id, {
        viewedBy: viewedBy,
        'analytics.views': viewCount
      });

      console.log(`Added ${viewCount} views to property: ${property.title}`);
    }

    // Add sample bookings
    for (let i = 0; i < 8; i++) {
      const randomProperty = properties[Math.floor(Math.random() * properties.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const bookingDate = new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000); // Last 15 days
      
      const booking = new Booking({
        tenant: randomUser._id,
        property: randomProperty._id,
        owner: randomProperty.owner,
        type: 'booking',
        status: ['pending', 'confirmed', 'cancelled'][Math.floor(Math.random() * 3)],
        tokenAmount: Math.floor(Math.random() * 5000) + 1000,
        paymentStatus: ['pending', 'paid', 'partial'][Math.floor(Math.random() * 3)],
        moveInDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        createdAt: bookingDate
      });

      await booking.save();
      console.log(`Added booking for property: ${randomProperty.title}`);
    }

    // Add sample enquiries
    for (let i = 0; i < 12; i++) {
      const randomProperty = properties[Math.floor(Math.random() * properties.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const enquiryDate = new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000); // Last 20 days
      
      const enquiry = new Enquiry({
        user: randomUser._id,
        property: randomProperty._id,
        owner: randomProperty.owner,
        subject: ['General Inquiry', 'Rent Negotiation', 'Property Visit', 'Maintenance Query'][Math.floor(Math.random() * 4)],
        message: 'Sample enquiry message for analytics testing',
        status: ['pending', 'responded', 'closed'][Math.floor(Math.random() * 3)],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        createdAt: enquiryDate
      });

      await enquiry.save();
      console.log(`Added enquiry for property: ${randomProperty.title}`);
    }

    // Add sample favorites
    for (let i = 0; i < 15; i++) {
      const randomProperty = properties[Math.floor(Math.random() * properties.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Check if favorite already exists
      const existingFavorite = await Favorite.findOne({
        user: randomUser._id,
        property: randomProperty._id
      });

      if (!existingFavorite) {
        const favorite = new Favorite({
          user: randomUser._id,
          property: randomProperty._id,
          createdAt: new Date(Date.now() - Math.random() * 25 * 24 * 60 * 60 * 1000)
        });

        await favorite.save();
        console.log(`Added favorite for property: ${randomProperty.title}`);
      }
    }

    // Add sample reviews
    for (let i = 0; i < 6; i++) {
      const randomProperty = properties[Math.floor(Math.random() * properties.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      const review = new Review({
        tenant: randomUser._id,
        property: randomProperty._id,
        rating: Math.floor(Math.random() * 5) + 1,
        comment: 'Sample review comment for analytics testing',
        isActive: true,
        createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000)
      });

      await review.save();
      console.log(`Added review for property: ${randomProperty.title}`);
    }

    console.log('\n✅ Sample analytics data added successfully!');
    console.log('You can now test the analytics dashboard with real data.');
    
  } catch (error) {
    console.error('Error adding sample data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

addSampleAnalyticsData();
