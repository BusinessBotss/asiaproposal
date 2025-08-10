import React from 'react';
import Header from './components/Header.jsx';
import ComposeView from './components/ComposeView.jsx';
import { useSelector } from 'react-redux';

function App() {
  const { template } = useSelector((s) => s.selection);

  const translations = {
    'compose.crm': 'CRM',
    'compose.send': 'Send',
    'compose.recipients': 'Recipients',
    'compose.selectLocationRole': 'Select location and role',
  };

  const sendBroadcast = async (crmData) => {
    const message = template ? `Using template: ${template.name}` : 'No template';
    const recipients = (crmData?.workers || []).map((w) => w.phone);
    if (recipients.length === 0) {
      alert('No recipients');
      return;
    }
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, recipients }),
      });
      const data = await res.json();
      alert('Sent: ' + JSON.stringify(data));
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header />
      <ComposeView translations={translations} sendBroadcast={sendBroadcast} />
    </div>
  );
}

export default App;
