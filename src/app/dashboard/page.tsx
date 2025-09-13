'use client';

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to your personalized dashboard</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Stats Overview */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Upcoming Events</span>
              <span className="text-sm font-medium text-gray-900">3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">New Messages</span>
              <span className="text-sm font-medium text-gray-900">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Tasks</span>
              <span className="text-sm font-medium text-gray-900">2</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
              <span>View Events</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
              <span>Update Profile</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
              <span>View Notifications</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-2"></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">You have 2 pending tasks</p>
                <p className="text-xs text-gray-500">10 minutes ago</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">New event "Volunteer Day" added</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 h-2 w-2 rounded-full bg-purple-500 mt-2"></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Your profile was updated</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((event) => (
            <div key={event} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Community Volunteer Day</p>
                  <p className="text-sm text-gray-500">Fri, Jun 10 • 9:00 AM - 2:00 PM</p>
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Registered
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-gray-50 text-right">
          <button className="text-sm font-medium text-blue-600 hover:text-blue-500">
            View all events →
          </button>
        </div>
      </div>
    </div>
  );
}
