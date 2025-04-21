import React, { useEffect } from "react"
import { Outlet } from "react-router-dom"
import Navbar from "./components/Navbar/Navbar"
import Footer from "./components/Footer/Footer"
import ScrollToTop from "./scrollToTop"

function App() {
  useEffect(() => {
    console.log("App component mounted");
  }, []);

  try {
    return (
      <>
        <ScrollToTop/>
        <div className="">
          <Navbar/>
          <Outlet/>
          <Footer/>
        </div>
      </>
    )
  } catch (error) {
    console.error("Error in App component:", error);
    return <div>Something went wrong. Please check the console for details.</div>;
  }
}

export default App
