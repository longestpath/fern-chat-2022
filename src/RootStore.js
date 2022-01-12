import { types, flow /* use for async functions */ } from "mobx-state-tree";
import { sortBy } from "lodash";
import React from "react";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import {
  collection,
  query,
  onSnapshot,
  getFirestore,
  addDoc,
} from "firebase/firestore"; // use these to read and add channels to Firebase

// create a type used by your RootStore
const Channel = types.model("Channel", {
  id: types.identifier, // I'm gonna error out unless you change me to a string/ identifier
  name: types.string,
});

// create a RootStore that keeps all the state for the app
const RootStore = types
  .model("RootStore", {
    channels: types.optional(types.array(Channel), []),
    isLoggedIn: types.optional(types.boolean, false), // set to true for now since we don't really have login sessions yet
  })
  .views((self) => ({
    get channelsSorted() {
      return sortBy(self.channels, (c) => c.id);
    },
  }))
  .actions((self) => {
    // new functions for subscribing/ unsubscribing to channels
    let unsubscribeFromChannelsFeed; // use for cleanup
    const startStreamingChannels = () => {
      const db = getFirestore();

      const q = query(collection(db, "channels"));
      onSnapshot(q, querySnapshot => {
        self.updateChannels(querySnapshot);
      });
      // make a query and call onSnapshot to subscribe to changes from the query
    };

    const stopStreamingChannels = () => {
      if (unsubscribeFromChannelsFeed) {
        unsubscribeFromChannelsFeed();
      }
    };
    
     // semi-private function only used to encapsulate channel update
    const updateChannels = (querySnapshot) => {
      self.channels = [];
      querySnapshot.forEach(doc => {
        self.channels.push({id: doc.id, name: doc.data().name});
      });
    };

    const addChannel = flow(function* addChannel() {
      // made this function async just because
      const db = getFirestore();
      self.isLoading = true;
      // Dan: Flow is async? Who made the async?
      yield addDoc(collection(db, "channels"), {
          name: uniqueNamesGenerator({
          dictionaries: [adjectives, animals],
          length: 2,
          separator: "-",
          })
      });
    });

    const login = () => {
      self.isLoggedIn = true;
    };

    const logout = () => {
      self.isLoggedIn = false;
    };

    return {
      startStreamingChannels,
      stopStreamingChannels,
      updateChannels,
      addChannel,
      login,
      logout,
    };
  });


// Create a Provider that creates a singleton for the RootStore, wrap it in a Provider component, and create a custom hook to make it easy to use

const StoreContext = React.createContext(null);

export const StoreProvider = ({ children }) => {
  const store = RootStore.create({ /* no more mock data */ });
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
};

// We'll use this this to use the store in screen components
export const useStore = () => {
  const store = React.useContext(StoreContext);
  if (!store) {
    // not likely, but sure
    throw new Error("useStore must be used within a StoreProvider.");
  }
  return store;
};
