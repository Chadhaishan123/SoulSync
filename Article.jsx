import React from 'react'
import Acard from './Acard'
import { Link } from 'react-router-dom'

function Article() {
  return (
    <div className='pb-12'>
        <Acard/>
        <div className='text-end mr-14'>
        <Link to="/blogs">
          <button className="mt-14 px-6 py-3 text-2xl bg-[#44444433] text-black rounded-full hover:bg-[#4444444d] hover:text-black transition duration-300 hover:text-medium ">
            Read More
          </button>
        </Link>
        </div>
    </div> 
  )
}

export default Article