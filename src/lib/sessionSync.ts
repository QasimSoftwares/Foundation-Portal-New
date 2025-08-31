// Session synchronization across tabs using BroadcastChannel and localStorage
type SessionEvent = 'activity' | 'logout' | 'extend';

class SessionSync {
  private channel: BroadcastChannel;
  private static instance: SessionSync;
  private listeners: Map<SessionEvent, Set<() => void>> = new Map();

  private constructor() {
    // Create a BroadcastChannel for cross-tab communication
    this.channel = new BroadcastChannel('session_sync');
    
    // Listen for messages from other tabs
    this.channel.onmessage = (event: MessageEvent<{ type: SessionEvent }>) => {
      const { type } = event.data;
      this.notifyListeners(type);
    };

    // Also listen for storage events (for older browsers)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === 'session_activity') {
          this.notifyListeners('activity');
        } else if (event.key === 'session_logout') {
          this.notifyListeners('logout');
        } else if (event.key === 'session_extend') {
          this.notifyListeners('extend');
        }
      });
    }
  }

  public static getInstance(): SessionSync {
    if (!SessionSync.instance) {
      SessionSync.instance = new SessionSync();
    }
    return SessionSync.instance;
  }

  public on(event: SessionEvent, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    
    // Return cleanup function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public broadcastActivity(): void {
    this.broadcast('activity');
  }

  public broadcastLogout(): void {
    this.broadcast('logout');
  }

  public broadcastExtend(): void {
    this.broadcast('extend');
  }

  private broadcast(type: SessionEvent): void {
    try {
      // Broadcast via BroadcastChannel
      this.channel.postMessage({ type });
      
      // Also update localStorage for fallback
      if (typeof window !== 'undefined') {
        const key = `session_${type}`;
        localStorage.setItem(key, Date.now().toString());
        // Remove the item to prevent storage from filling up
        setTimeout(() => localStorage.removeItem(key), 100);
      }
    } catch (error) {
      console.error('Error broadcasting session event:', error);
    }
  }

  private notifyListeners(type: SessionEvent): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }
}

export const sessionSync = SessionSync.getInstance();
