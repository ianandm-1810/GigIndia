const Review = require("../models/Review");
const User = require("../models/User");

const refreshUserRating = async (userId) => {
  const [summary] = await Review.aggregate([
    { $match: { reviewee: userId } },
    { $group: { _id: "$reviewee", average: { $avg: "$rating" }, count: { $sum: 1 } } }
  ]);
  await User.findByIdAndUpdate(userId, {
    $set: {
      rating: summary ? Math.round(summary.average * 10) / 10 : 0,
      totalReviews: summary?.count || 0
    }
  });
};

module.exports = { refreshUserRating };
