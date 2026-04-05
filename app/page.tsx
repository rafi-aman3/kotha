import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen font-sans">
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Welcome to Kotha
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Connect with friends, share your thoughts, and see who's online right now in real time.
          </p>
          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white mt-4">
            Get Started
          </Button>
        </div>
      </main>
    </div>
  );
}
