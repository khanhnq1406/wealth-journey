export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-primary-600 h-screen">
      <div className="block sm:grid grid-cols-[40%_60%]">
        <div className="hidden sm:flex justify-center content-center flex-wrap gap-[20px]">
          <div className="flex gap-2">
            <img className="w-[80px] h-[80px]" src="/logo.svg" alt="Logo" />
            <div className="text-white">
              <p className="font-extrabold text-[30px]">WealthJourney</p>
              <p>Your Trusted Guide to Financial Freedom</p>
            </div>
          </div>
          <img src="/login-stock.svg" className="w-3/5" alt="Login picture" />
        </div>
        <div className="bg-neutral-50 h-screen">{children}</div>
      </div>
    </div>
  );
}
