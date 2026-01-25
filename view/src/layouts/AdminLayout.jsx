import { Outlet } from "react-router-dom";
import Navbar from "../admincomponents/Navbar";
import Sidebar from "../admincomponents/Sidebar";
const AdminLayout = () => {
  return (
    <>
    <Navbar/>
     <div className='flex'>
      <Sidebar/>
      <div className='flex-1 px-4 py-10 md:px-10 h-[calc(100vh-64px)] overflow-y-auto'>
        <Outlet/>
      </div>
     </div>
    </>
      
    
  );
};

export default AdminLayout;
