import { useState } from "react";
import { Robot, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Tooltip } from "@/components/tooltip/Tooltip";
import { InvoiceForm } from "@/components/invoice-form/InvoiceForm";
import { APPROVAL } from "@/shared";

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: "call" | "result" | "partial-call";
  step?: number;
  args: Record<string, unknown>;
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
}

interface ToolInvocationCardProps {
  toolInvocation: ToolInvocation;
  toolCallId: string;
  needsConfirmation: boolean;
  addToolResult: (args: { toolCallId: string; result: string }) => void;
}

export function ToolInvocationCard({
  toolInvocation,
  toolCallId,
  needsConfirmation,
  addToolResult,
}: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // For createInvoice tool, render the form outside the collapsible card
  if (toolInvocation.toolName === "createInvoice" && needsConfirmation) {
    if (toolInvocation.state === "call") {
      return (
        <div className="my-3 w-full max-w-2xl">
          <InvoiceForm
            initialData={{
              name: toolInvocation.args.name as string,
              description: toolInvocation.args.description as string,
              price: toolInvocation.args.price as number,
            }}
            onSubmit={(formData) => {
              // Update the tool invocation args with the form data
              const updatedArgs = {
                name: formData.name,
                description: formData.description,
                price: formData.price,
              };

              // Store the updated args in the tool invocation
              toolInvocation.args = updatedArgs;

              addToolResult({
                toolCallId,
                result: APPROVAL.YES,
              });
            }}
            onCancel={() =>
              addToolResult({
                toolCallId,
                result: APPROVAL.NO,
              })
            }
          />
        </div>
      );
    } else if (toolInvocation.state === "result") {
      // Show completed invoice tile
      return (
        <div className="my-3 w-full max-w-2xl">
          <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 dark:bg-green-800 p-1.5 rounded-full">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-green-800 dark:text-green-200">Invoice Created</h3>
              </div>
              <span className="text-xs text-green-600 dark:text-green-400">✓ Saved to records</span>
            </div>
            
            <div className="mt-3 space-y-2 text-sm">
              {/* Row 1: Price and Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 block">Price</span>
                  <span className="text-lg font-bold text-green-800 dark:text-green-200">${(toolInvocation.args.price as number).toFixed(2)}</span>
                </div>
                
                <div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-300 block">Name</span>
                  <span className="text-green-800 dark:text-green-200">{toolInvocation.args.name as string}</span>
                </div>
              </div>
              
              {/* Row 2: Description */}
              <div>
                <span className="text-xs font-medium text-green-700 dark:text-green-300 block">Description</span>
                <span className="text-green-800 dark:text-green-200">{toolInvocation.args.description as string}</span>
              </div>
            </div>
          </Card>
        </div>
      );
    }
  }

  return (
    <Card
      className={`p-4 my-3 w-full max-w-[500px] rounded-md bg-neutral-100 dark:bg-neutral-900 ${
        needsConfirmation ? "" : "border-[#F48120]/30"
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <div
          className={`${needsConfirmation ? "bg-[#F48120]/10" : "bg-[#F48120]/5"} p-1.5 rounded-full flex-shrink-0`}
        >
          <Robot size={16} className="text-[#F48120]" />
        </div>
        <h4 className="font-medium flex items-center gap-2 flex-1 text-left">
          {toolInvocation.toolName}
          {!needsConfirmation && toolInvocation.state === "result" && (
            <span className="text-xs text-[#F48120]/70">✓ Completed</span>
          )}
        </h4>
        <CaretDown
          size={16}
          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "180px" : "0px" }}
        >
          <div className="mb-3">
            <h5 className="text-xs font-medium mb-1 text-muted-foreground">
              Arguments:
            </h5>
            <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>

          {needsConfirmation && toolInvocation.state === "call" && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  addToolResult({
                    toolCallId,
                    result: APPROVAL.NO,
                  })
                }
              >
                Reject
              </Button>
              <Tooltip content={"Accept action"}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    addToolResult({
                      toolCallId,
                      result: APPROVAL.YES,
                    })
                  }
                >
                  Approve
                </Button>
              </Tooltip>
            </div>
          )}

          {!needsConfirmation && toolInvocation.state === "result" && (
            <div className="mt-3 border-t border-[#F48120]/10 pt-3">
              <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                Result:
              </h5>
              <pre className="bg-background/80 p-2 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px]">
                {(() => {
                  const result = toolInvocation.result;
                  if (typeof result === "object" && result.content) {
                    return result.content
                      .map((item: { type: string; text: string }) => {
                        if (
                          item.type === "text" &&
                          item.text.startsWith("\n~ Page URL:")
                        ) {
                          const lines = item.text.split("\n").filter(Boolean);
                          return lines
                            .map(
                              (line: string) => `- ${line.replace("\n~ ", "")}`
                            )
                            .join("\n");
                        }
                        return item.text;
                      })
                      .join("\n");
                  }
                  return JSON.stringify(result, null, 2);
                })()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
