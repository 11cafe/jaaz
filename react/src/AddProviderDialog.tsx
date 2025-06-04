import { useState } from "react";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { PlusIcon, XIcon } from "lucide-react";

export function AddProviderDialog({
  onSave,
  onClose,
}: {
  onSave: (
    provider: string,
    apiKey: string,
    apiUrl: string,
    models: string[]
  ) => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelList, setModelList] = useState<string[]>([]);
  const handleSave = () => {
    if (!provider || !apiKey || !apiUrl || modelList.length === 0) {
      alert("Please fill in all fields");
      return;
    }

    onSave(provider, apiKey, apiUrl, modelList);
    onClose();
  };
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[50vw]">
        <DialogHeader>
          <DialogTitle>Add API Provider</DialogTitle>
          <DialogDescription>
            Support all OpenAI chat completion compatible API providers
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Provider Name"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="mb-2"
        />
        <Label>API Key</Label>
        <Input
          placeholder="sk-ubio..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mb-2"
        />
        <Label>API URL</Label>
        <Input
          placeholder="https://api.provider.com/v1"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          className="mb-2"
        />
        <Label>Models</Label>

        <div className="flex gap-2">
          <Input
            placeholder="deepseek/deepseek-r1-distill-qwen-7b"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="mb-4"
          />
          <Button
            onClick={() => {
              setModelList([...modelList, modelName]);
              setModelName("");
            }}
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {modelList.map((model) => (
            <div className="flex items-center gap-2">
              <p>{model}</p>
              <Button
                size={"xs"}
                variant="outline"
                onClick={() =>
                  setModelList(modelList.filter((m) => m !== model))
                }
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} className="w-full">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
