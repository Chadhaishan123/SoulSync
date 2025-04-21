import React from 'react'
import FrontPage from '../pages/FrontPage/FrontPage'
import About from '../pages/About/About'
import HelpPage from '../pages/HelpPage/HelpPage'
import SessionPage from '../pages/SessionPage/SessionPage'
import DetoxPage from '../pages/DetoxPage/DetoxPage'
import Dream from '../components/Dream/Dream'
import TherapyPage from '../pages/TherapyPage/TherapyPage'
import ArticlePage from '../pages/ArticlePage/ArticlePage'
import DostPage from '../pages/DostPage/DostPage'
import ReviewPage from '../pages/ReviewPage/ReviewPage'


function HomePage() {
  return (
    <div>
    <FrontPage/>
    <About/>
    <HelpPage/>
    <SessionPage/>
    <DetoxPage/>
    <Dream/>
    <TherapyPage/>
    <img src="/heal.svg" alt="" className="w-full lg:block hidden" />
     <ArticlePage/>
     <DostPage/>
     <ReviewPage/>
   
    
    </div>
  )
}

export default HomePage