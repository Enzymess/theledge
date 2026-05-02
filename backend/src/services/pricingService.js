async function calculate({ roomId, checkin, checkout, promoCode, db, dryRun = false }) {
  const start  = new Date(checkin);
  const end    = new Date(checkout);
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (nights < 1) throw new Error('Invalid date range');

  const room = db.findById('rooms', roomId);
  if (!room) throw new Error('Room not found');

  const weekdayPrice = room.weekday_price || room.base_price;
  const weekendPrice = room.weekend_price || room.base_price;

  let subtotal  = 0;
  const breakdown = [];

  for (let i = 0; i < nights; i++) {
    const date      = new Date(start);
    date.setDate(date.getDate() + i);
    const day       = date.getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;
    const basePrice = isWeekend ? weekendPrice : weekdayPrice;
    const dateStr   = date.toISOString().split('T')[0];

    // Check seasonal modifier
    const season    = db.findOne('seasons', s => dateStr >= s.start_date && dateStr <= s.end_date);
    const modifier  = season ? (1 + season.modifier_percent / 100) : 1;
    const adjusted  = Math.round(basePrice * modifier);

    subtotal += adjusted;
    breakdown.push({ date: dateStr, price: adjusted, isWeekend, seasonal: !!season });
  }

  // Apply promo code
  let discount = 0;
  if (promoCode) {
    const today = new Date().toISOString().split('T')[0];
    const promo = db.findOne('promos', p =>
      p.code === promoCode.toUpperCase() &&
      p.is_active &&
      (!p.valid_until || p.valid_until >= today) &&
      (!p.max_uses || p.uses_count < p.max_uses)
    );
    if (promo) {
      discount = promo.discount_type === 'percent'
        ? Math.round(subtotal * (promo.discount_value / 100))
        : Math.min(promo.discount_value, subtotal);

      // FIX: only increment usage on real bookings, not price previews
      if (!dryRun) {
        db.updateById('promos', promo.id, { uses_count: (promo.uses_count || 0) + 1 });
      }
    }
  }

  return { nights, subtotal, discount, total: subtotal - discount, breakdown };
}

module.exports = { calculate };
