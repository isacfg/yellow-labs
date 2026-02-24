import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Chat() {
  const user = useQuery(api.users.viewer);
  const createConversation = useMutation(api.conversations.create);
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      navigate("/auth", { replace: true });
      return;
    }
    if (user) {
      createConversation().then((id) => {
        navigate(`/chat/${id}`, { replace: true });
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
