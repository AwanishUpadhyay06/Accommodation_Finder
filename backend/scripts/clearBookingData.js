const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Notification = require('../models/Notification');

async function clearBookingData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rental-platform');
    console.log('Connected to MongoDB');

    console.log('\n🗑️  Starting data cleanup...\n');

    // Clear Bookings
    console.log('Clearing bookings...');
    const bookingsDeleted = await Booking.deleteMany({});
    console.log(`✅ Deleted ${bookingsDeleted.deletedCount} bookings`);

    // Clear Enquiries
    console.log('Clearing enquiries...');
    const enquiriesDeleted = await Enquiry.deleteMany({});
    console.log(`✅ Deleted ${enquiriesDeleted.deletedCount} enquiries`);

    // Clear booking-related notifications (optional - keeps other notifications)
    console.log('Clearing booking-related notifications...');
    const notificationsDeleted = await Notification.deleteMany({
      $or: [
        { type: { $regex: /booking/i } },
        { type: { $regex: /visit/i } },
        { type: { $regex: /enquiry/i } },
        { type: { $regex: /reservation/i } }
      ]
    });
    console.log(`✅ Deleted ${notificationsDeleted.deletedCount} booking-related notifications`);

    console.log('\n🎉 Data cleanup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Bookings deleted: ${bookingsDeleted.deletedCount}`);
    console.log(`   • Enquiries deleted: ${enquiriesDeleted.deletedCount}`);
    console.log(`   • Notifications deleted: ${notificationsDeleted.deletedCount}`);
    console.log('\n✨ Your project structure and other data remain intact!');

  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
    process.exit(0);
  }
}

// Run the cleanup
clearBookingData();
