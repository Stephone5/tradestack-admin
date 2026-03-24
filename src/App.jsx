import React, { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [businesses, setBusinesses] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Mock data - replace with real API calls
  useEffect(() => {
    setTimeout(() => {
      setBusinesses([
        { id: 1, name: 'Acme Corp', owner: 'John Smith', revenue: '$125,000', status: 'active' },
        { id: 2, name: 'Tech Solutions', owner: 'Jane Doe', revenue: '$89,500', status: 'active' },
        { id: 3, name: 'Local Bakery', owner: 'Bob Wilson', revenue: '$42,300', status: 'inactive' },
      ])
      setUsers([
        { id: 1, name: 'John Smith', email: 'john@acme.com', plan: 'Pro', status: 'active' },
        { id: 2, name: 'Jane Doe', email: 'jane@techsol.com', plan: 'Basic', status: 'active' },
        { id: 3, name: 'Bob Wilson', email: 'bob@bakery.com', plan: 'Pro', status: 'inactive' },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  const StatCard = ({ title, value, icon }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-lg font-medium mb-2">{title}</p>
          <p className="text-4xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-5xl">{icon}</div>
      </div>
    </div>
  )

  const TabButton = ({ id, label, isActive, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-xl">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">TradeStack Admin</h1>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-gray-700 text-lg">Admin User</span>
              <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
        <div className="mb-10">
          <div className="flex space-x-2 bg-gray-100 p-2 rounded-xl">
            <TabButton
              id="overview"
              label="📊 Overview"
              isActive={activeTab === 'overview'}
              onClick={setActiveTab}
            />
            <TabButton
              id="businesses"
              label="🏢 Businesses"
              isActive={activeTab === 'businesses'}
              onClick={setActiveTab}
            />
            <TabButton
              id="users"
              label="👥 Users"
              isActive={activeTab === 'users'}
              onClick={setActiveTab}
            />
            <TabButton
              id="settings"
              label="⚙️ Settings"
              isActive={activeTab === 'settings'}
              onClick={setActiveTab}
            />
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <StatCard title="Total Businesses" value="1,247" icon="🏢" />
              <StatCard title="Active Users" value="3,892" icon="👥" />
              <StatCard title="Monthly Revenue" value="$89.2k" icon="💰" />
              <StatCard title="Growth Rate" value="+12.5%" icon="📈" />
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-lg font-medium text-gray-900">New business registered</p>
                    <p className="text-gray-600 text-base">Digital Marketing Pro - 2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-2xl">💳</span>
                  <div>
                    <p className="text-lg font-medium text-gray-900">Payment processed</p>
                    <p className="text-gray-600 text-base">$299 subscription - Acme Corp</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <span className="text-2xl">🚨</span>
                  <div>
                    <p className="text-lg font-medium text-gray-900">Support ticket created</p>
                    <p className="text-gray-600 text-base">Invoice export issue - Tech Solutions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'businesses' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-8 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">Business Accounts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Business Name</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Owner</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Revenue</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Status</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50">
                      <td className="px-8 py-6 text-lg text-gray-900 font-medium">{business.name}</td>
                      <td className="px-8 py-6 text-lg text-gray-700">{business.owner}</td>
                      <td className="px-8 py-6 text-lg text-gray-700">{business.revenue}</td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-2 rounded-full text-base font-medium ${
                          business.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {business.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-lg">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-8 border-b border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">User Accounts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Name</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Email</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Plan</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Status</th>
                    <th className="px-8 py-4 text-left text-lg font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-8 py-6 text-lg text-gray-900 font-medium">{user.name}</td>
                      <td className="px-8 py-6 text-lg text-gray-700">{user.email}</td>
                      <td className="px-8 py-6 text-lg text-gray-700">{user.plan}</td>
                      <td className="px-8 py-6">
                        <span className={`px-4 py-2 rounded-full text-base font-medium ${
                          user.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-lg">Edit User</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">Email Notifications</h4>
                    <p className="text-gray-600 text-base">Send system alerts via email</p>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors">
                    Configure
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">Data Backup</h4>
                    <p className="text-gray-600 text-base">Automated daily backups</p>
                  </div>
                  <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors">
                    View Backups
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">API Access</h4>
                    <p className="text-gray-600 text-base">Manage API keys and permissions</p>
                  </div>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium text-lg transition-colors">
                    Manage Keys
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App