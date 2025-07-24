
import Image from "next/image";
import ChatBot from "./ChatBot";

export default function Home() {
  return (
    <div className="font-sans grid items-center justify-items-center min-h-screen sm:p-10">
      <main className="flex flex-col gap-[22px] row-start-1 items-center sm:items-start">
        <ChatBot />
      </main>
    </div>
  );
}
