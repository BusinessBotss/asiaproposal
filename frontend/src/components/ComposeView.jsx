import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { updateSelectedLocation, updateSelectedRole, updateSelectedTemplate, updateNote } from '../slices/selectionSlice';

export default function ComposeView({ translations, sendBroadcast }) {
  const dispatch = useDispatch();
  const { location, role, template, note } = useSelector((s) => s.selection);
  const [crmData, setCrmData] = useState(null);

  useEffect(() => {
    if (location && role) {
      axios
        .get(`/api/crm?location=${encodeURIComponent(location)}&role=${encodeURIComponent(role)}`)
        .then((r) => setCrmData(r.data))
        .catch(() => setCrmData(null));
    } else {
      setCrmData(null);
    }
  }, [location, role]);

  return (
    <div className="view-content p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-effect rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="bg-transparent border border-gray-700 rounded px-3 py-2"
                placeholder="Location (e.g., NY, SF)"
                value={location}
                onChange={(e) => dispatch(updateSelectedLocation(e.target.value))}
              />
              <input
                className="bg-transparent border border-gray-700 rounded px-3 py-2"
                placeholder="Role (e.g., Manager, Worker)"
                value={role}
                onChange={(e) => dispatch(updateSelectedRole(e.target.value))}
              />
              <select
                className="bg-transparent border border-gray-700 rounded px-3 py-2"
                value={template?.id || ''}
                onChange={(e) => dispatch(updateSelectedTemplate({ id: e.target.value || null, name: e.target.selectedOptions[0]?.text || '' }))}
              >
                <option value="">Select template</option>
                <option value="template-1">Reminder</option>
                <option value="template-2">Announcement</option>
              </select>
              <input
                className="bg-transparent border border-gray-700 rounded px-3 py-2"
                placeholder="Note"
                value={note}
                onChange={(e) => dispatch(updateNote(e.target.value))}
              />
            </div>
          </div>

          <div className="glass-effect rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">{translations['compose.crm'] || 'CRM'}</h3>
            <div id="crm-preview" className="text-sm text-gray-400">
              {crmData ? (
                <>
                  <div className="text-white mb-2">
                    <div>{crmData.name}</div>
                    <div className="text-xs text-gray-400">{crmData.address}</div>
                  </div>
                  <div className="text-green-400 font-medium mb-1">{translations['compose.recipients'] || 'Recipients'}:</div>
                  {crmData.workers?.map((w) => (
                    <div key={w.phone} className="py-2 border-b border-gray-700">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-gray-400">{w.phone}</div>
                    </div>
                  ))}
                </>
              ) : (
                <span>{translations['compose.selectLocationRole'] || 'Select location and role'}</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-effect rounded-xl p-6 sticky top-24">
            <div className="font-semibold mb-2">Preview</div>
            <div className="text-sm text-gray-300">
              {template ? `Template: ${template.name}` : 'No template selected'}
            </div>
            {note && <div className="text-sm mt-2">Note: {note}</div>}
          </div>

          <button
            onClick={() => sendBroadcast(crmData)}
            disabled={!location || !role || !template}
            className="w-full bg-green-400 disabled:bg-gray-600 text-black font-semibold py-3 px-6 rounded-lg"
          >
            {translations['compose.send'] || 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}