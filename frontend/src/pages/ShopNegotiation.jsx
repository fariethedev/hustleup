import { Navigate, useParams } from 'react-router-dom';

// Retire the old mandatory negotiation step, including links saved in browser history.
// Real listing offers still use the opt-in conversation/booking flow.
export default function ShopNegotiation() {
  const { id } = useParams();
  return <Navigate to={`/shop/${encodeURIComponent(id)}`} replace />;
}
