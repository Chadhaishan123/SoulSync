import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import HomePage from './Final/HomePage.jsx'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  createRoutesFromElements,

} from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from './store/store.js';

import TherapistPage from './Final/TherapistPage.jsx'
import Dream from './Final/Dream.jsx'
import Detox from './Final/Detox.jsx'
import Talk from './Final/Talk.jsx'
import AboutUs from './Final/AboutUs.jsx'
import TherapyPage from './Final/TherapyPage.jsx'
import Blogs from './pages/Blog/Blogs.jsx'
import Ques from './components/Ques/meQues.jsx'
import QuesFamily from './components/Ques/familyQues.jsx'
import QuesFriend from './components/Ques/friendQues.jsx'

const router = createBrowserRouter(
  createRoutesFromElements(


    <Route path='/' element={<App />}>
      <Route path="" element={<HomePage />} />
      <Route path="book-session" element={<TherapistPage />} />
      <Route path="dream-analyzer" element={<Dream />} />
      <Route path="digital-detox" element={<Detox />} />
      <Route path="talk-with-ai" element={<Talk />} />
      <Route path="about-us" element={<AboutUs />} />
      <Route path="audio-video-therapy" element={<TherapyPage />} />
      <Route path="blogs" element={<Blogs />} />
      <Route path="my-questions" element={<Ques />} />
      <Route path="family-questions" element={<QuesFamily />} />
      <Route path="friend-questions" element={<QuesFriend />} />
    </Route>


  )
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>

    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>

  </React.StrictMode>,
)