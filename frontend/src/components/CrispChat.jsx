import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';

const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;

// Injects the Crisp live-chat widget script. Renders nothing and does nothing until
// VITE_CRISP_WEBSITE_ID is set, so the app behaves identically for anyone who hasn't
// signed up for Crisp yet.
export default function CrispChat() {
  const user = useSelector(selectUser);

  useEffect(() => {
    if (!websiteId || document.getElementById('crisp-chat-script')) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement('script');
    script.id = 'crisp-chat-script';
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!websiteId || !window.$crisp) return;
    if (user?.email) {
      window.$crisp.push(['set', 'user:email', [user.email]]);
      if (user.fullName) window.$crisp.push(['set', 'user:nickname', [user.fullName]]);
    }
  }, [user]);

  return null;
}
