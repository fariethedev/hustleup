export const deliverySteps = {
  PICKUP: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COLLECTED'],
  PARCEL_LOCKER: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'READY_FOR_PICKUP', 'COLLECTED'],
  COURIER: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  POST: ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'],
  SELLER_DELIVERY: ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  DIGITAL: ['CONFIRMED', 'DELIVERED'],
  NONE: ['CONFIRMED', 'DELIVERED'],
};
export const orderLabel = value => (value || 'Not started').replaceAll('_', ' ').toLowerCase();
export function orderState(order, userId, claim) {
  const paid = ['PAID', 'TRANSFERRED'].includes(order.paymentStatus) || ['PAID', 'FULFILLED'].includes(order.status);
  const buyer = order.buyerId === userId || order.role === 'buyer';
  const active = !['CANCELLED', 'REFUNDED'].includes(order.status) && order.paymentStatus !== 'REFUNDED';
  const open = claim?.status === 'OPEN';
  const lastOfferBy = order.lastOfferBy || (order.status === 'NEGOTIATING' ? order.sellerId : order.buyerId);
  return {
    buyer, paid, active, open,
    canRespond: order.kind === 'booking' && ['INQUIRED', 'NEGOTIATING'].includes(order.status) && lastOfferBy !== userId,
    canReceive: buyer && paid && active && !open && !order.fulfilment?.buyerConfirmedAt,
    canReport: buyer && paid && active && !open,
    canTrack: !buyer && paid && active && !order.fulfilment?.buyerConfirmedAt,
    canPay: buyer && order.kind === 'booking' && order.status === 'BOOKED' && (!order.paymentStatus || order.paymentStatus === 'PENDING'),
    payout: ['TRANSFERRED', 'RELEASED'].includes(order.paymentStatus || order.payoutStatus) ? 'Released to seller'
      : open ? 'On hold · problem reported' : !active ? 'Closed'
      : order.fulfilment?.buyerConfirmedAt ? 'Receipt approved · release pending'
      : paid ? 'Awaiting receipt confirmation' : 'Awaiting payment',
  };
}
