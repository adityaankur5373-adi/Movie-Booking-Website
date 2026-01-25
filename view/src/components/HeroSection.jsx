import React from "react";
import { assets } from "../assets/assets";
import { CalendarIcon, ClockIcon, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex flex-col items-start justify-center gap-4
                 px-6 md:px-16 lg:px-16
                 bg-cover bg-center
                 h-screen"
      style={{
        backgroundImage:
          "url('20190426quebra-cabecas-vingadores-ultimato-kin-leung-avengers-endgame-collection-jigsaw-puzzle-02.jpg')",
      }}
    >
      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />

      <img
        src={assets.marvelLogo}
        alt="Marvel"
        className="relative z-10 max-h-10 lg:h-11 mt-24 md:mt-28 ml-0 md:ml-10 lg:ml-20"
      />

      <h1
        className="
          relative z-10
          text-4xl md:text-[56px]
          leading-[1.1]
          font-extrabold uppercase tracking-wide
          text-transparent bg-clip-text
          bg-gradient-to-r from-rose-300 to-white
          drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]
          ml-0 md:ml-10 lg:ml-20
        "
      >
        Avengers <br /> Infinity War
      </h1>

      <div className="relative z-10 flex items-center gap-4 text-gray-300 ml-0 md:ml-10 lg:ml-20">
        <span>Action | Adventure | Sci-Fi</span>

        <div className="flex items-center gap-1">
          <CalendarIcon className="w-4 h-4" />
          2018
        </div>

        <div className="flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          2h 8m
        </div>
      </div>

      <p className="relative z-10 max-w-md text-gray-300 ml-0 md:ml-10 lg:ml-20">
        In a post-apocalyptic world where cities ride on wheels and consume each
        other to survive, two people meet in London and try to stop a conspiracy
      </p>

      <button
        onClick={() => {navigate("/movies"),scrollTo(0,0)}}
        className="relative z-10 ml-0 md:ml-10 lg:ml-20 flex items-center gap-2 px-6 py-3 text-sm bg-primary
                   hover:bg-primary-dull transition rounded-full font-medium cursor-pointer"
      >
        Explore Movies
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default HeroSection;
