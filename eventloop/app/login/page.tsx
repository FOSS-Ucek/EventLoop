import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 border rounded space-y-4 text-center">
        <h1 className="text-xl font-bold">Sign In</h1>
        <p className="text-sm text-gray-600">Please sign in to continue</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full border py-2 px-4 rounded bg-white dark:bg-zinc-800 font-medium hover:bg-gray-50"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}

