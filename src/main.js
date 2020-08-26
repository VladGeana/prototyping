import Vue from 'vue';
import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';
import vuetify from './plugins/vuetify';
import VueSocketIO from 'vue-socket.io';
import SocketIO from 'socket.io-client';
import config from '@/config.json';

Vue.config.productionTip = false;
Vue.use(
  new VueSocketIO({
    debug: true,
    connection: SocketIO(config.socketUrl), //options object is Optional
    // vuex: {
    //   store,
    //   actionPrefix: 'SOCKET_',
    //   mutationPrefix: 'SOCKET_',
    // },
  })
);
new Vue({
  router,
  store,
  vuetify,
  render: (h) => h(App),
}).$mount('#app');
