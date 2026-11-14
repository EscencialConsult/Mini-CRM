import logo from "@/assets/logo.webp";

/**
 * Splash screen displayed when no resources are configured yet.
 *
 * Automatically shown when the admin app has no Resource children defined.
 */
export const Ready = () => (
  <div className="flex flex-col h-screen">
    <div
      className="flex-1 flex flex-col text-white text-center justify-center items-center"
      style={{
        background:
          "linear-gradient(135deg, #000000 0%, #1a181d 55%, #6b1e13 100%)",
      }}
    >
      <img className="w-32 h-32 mb-4" src={logo} alt="" />
      <h1 className="text-3xl mb-4">Dealflow</h1>
      <div className="text-lg opacity-75">
        Your application is properly configured.
        <br />
        Now you can add a &lt;Resource&gt; as child of
        &lt;Admin&gt;&lt;/Admin&gt;
      </div>
    </div>
  </div>
);
