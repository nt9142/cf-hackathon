/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import { getCurrentAgent } from "agents";
import { unstable_scheduleSchema } from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

const setMemory = tool({
  description:
    "A tool to set a specific memory entry by key-value pair. This preserves existing memories.",
  parameters: z.object({
    key: z.string().describe("The key for the memory entry"),
    value: z.string().describe("The value to store for this key"),
  }),
  execute: async ({ key, value }) => {
    const { agent } = getCurrentAgent();
    const agentState = agent!.state as { memory?: Record<string, string> };
    const currentMemory = agentState.memory || {};

    // Merge the new key-value pair with existing memory
    const updatedMemory = {
      ...currentMemory,
      [key]: value,
    };

    agent?.setState({
      memory: updatedMemory,
    });
    return `Memory "${key}" set to "${value}"`;
  },
});

const forgetMemory = tool({
  description: "A tool to forget a specific memory entry by key",
  parameters: z.object({
    key: z.string().describe("The key of the memory entry to forget"),
  }),
  execute: async ({ key }) => {
    const { agent } = getCurrentAgent();
    const agentState = agent!.state as { memory?: Record<string, string> };
    const currentMemory = agentState.memory || {};

    // Create new memory object without the specified key
    const { [key]: _, ...updatedMemory } = currentMemory;

    agent?.setState({
      memory: updatedMemory,
    });
    return `Memory entry "${key}" forgotten`;
  },
});

const addMcpServer = tool({
  description: "A tool to dynamically add an MCP server",
  parameters: z.object({
    url: z.string(),
    name: z.string(),
  }),
  execute: async ({ url, name }) => {
    const { agent } = getCurrentAgent();
    if (!agent) {
      throw new Error("No agent found");
    }
    const { id, authUrl } = await agent.addMcpServer(
      name,
      url,
      "http://localhost:5173"
    );
    return `MCP server added with id ${id}. ${authUrl ? `Authentication is necessary. Use URL: ${authUrl}` : ""}`;
  },
});

const removeMcpServer = tool({
  description: "A tool to remove an MCP server by id",
  parameters: z.object({
    id: z.string(),
  }),
  execute: async ({ id }) => {
    const { agent } = getCurrentAgent();
    if (!agent) {
      throw new Error("No agent found");
    }
    await agent.removeMcpServer(id);
    return `MCP server removed with id ${id}`;
  },
});

const listMcpServers = tool({
  description: "A tool to list all MCP servers",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent();
    return agent!.getMcpServers();
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Invoice creation tool that requires human confirmation
 * When invoked, this will present a form dialog to the user
 * The actual implementation is in the executions object below
 */
const createInvoice = tool({
  description:
    "Create a new expense/invoice with name, description, and price. Use this when user wants to add a new expense or create an invoice record. This will show a UI form for data entry.",
  parameters: z.object({
    name: z.string().describe("The name/title of the expense or invoice"),
    description: z.string().describe("Description of the expense or service"),
    price: z.number().describe("The amount/price for the expense"),
  }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Tool to list all invoices
 * This executes automatically without requiring human confirmation
 */
const listInvoices = tool({
  description:
    "List all local invoices/expenses created in this session. For persistent storage, use MCP server tools instead.",
  parameters: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent();
    const agentState = agent!.state as {
      invoices?: Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        createdAt: string;
      }>;
    };
    const invoices = agentState.invoices || [];

    if (invoices.length === 0) {
      return "No local invoices found in this session. Use MCP server tools to access persistent expense storage.";
    }

    return invoices
      .map(
        (invoice) =>
          `ID: ${invoice.id}\nName: ${invoice.name}\nDescription: ${invoice.description}\nPrice: $${invoice.price.toFixed(2)}\nCreated: ${new Date(invoice.createdAt).toLocaleDateString()}`
      )
      .join("\n\n");
  },
});

// Expense management tools using direct API calls
const addExpense = tool({
  description: "Add a new expense to persistent storage",
  parameters: z.object({
    amount: z.number().positive().describe("Expense amount"),
    description: z.string().min(1).describe("Expense description"),
    category: z.string().min(1).describe("Expense category"),
    date: z
      .string()
      .optional()
      .describe("Expense date (ISO string, defaults to current date)"),
    currency: z.string().default("USD").describe("Currency code"),
    tags: z.array(z.string()).optional().describe("Array of tags"),
    paymentMethod: z.string().optional().describe("Payment method used"),
    receipt: z.string().optional().describe("Receipt URL or reference"),
  }),
  execute: async ({
    amount,
    description,
    category,
    date,
    currency,
    tags,
    paymentMethod,
    receipt,
  }) => {
    try {
      const response = await fetch(
        "https://cf-hack-mcp.nt9142.workers.dev/api/expenses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            description,
            category,
            date: date || new Date().toISOString(),
            currency: currency || "USD",
            tags: tags || [],
            paymentMethod,
            receipt,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.error || "Failed to add expense"}`
        );
      }

      const data = await response.json();
      return `Expense added successfully: ${JSON.stringify(data.expense, null, 2)}`;
    } catch (error) {
      return `Error adding expense: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const getExpenses = tool({
  description: "Get expenses from persistent storage with optional filters",
  parameters: z.object({
    category: z.string().optional().describe("Filter by category"),
    startDate: z.string().optional().describe("Filter from date (ISO string)"),
    endDate: z.string().optional().describe("Filter to date (ISO string)"),
    limit: z.number().default(50).describe("Limit results"),
  }),
  execute: async ({ category, startDate, endDate, limit }) => {
    try {
      const response = await fetch(
        "https://cf-hack-mcp.nt9142.workers.dev/api/expenses"
      );

      if (!response.ok) {
        throw new Error(`API Error: Failed to fetch expenses`);
      }

      const data = await response.json();
      let expenses = data.expenses || [];

      // Apply filters
      if (category) {
        expenses = expenses.filter(
          (expense: any) => expense.category === category
        );
      }

      if (startDate) {
        expenses = expenses.filter((expense: any) => expense.date >= startDate);
      }

      if (endDate) {
        expenses = expenses.filter((expense: any) => expense.date <= endDate);
      }

      // Apply limit
      expenses = expenses.slice(0, limit);

      return `Found ${expenses.length} expenses:\n${JSON.stringify(expenses, null, 2)}`;
    } catch (error) {
      return `Error retrieving expenses: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const updateExpense = tool({
  description: "Update an existing expense in persistent storage",
  parameters: z.object({
    id: z.number().describe("Expense ID"),
    amount: z.number().positive().optional().describe("Expense amount"),
    description: z.string().min(1).optional().describe("Expense description"),
    category: z.string().min(1).optional().describe("Expense category"),
    date: z.string().optional().describe("Expense date (ISO string)"),
    currency: z.string().optional().describe("Currency code"),
    tags: z.array(z.string()).optional().describe("Array of tags"),
    paymentMethod: z.string().optional().describe("Payment method used"),
    receipt: z.string().optional().describe("Receipt URL or reference"),
  }),
  execute: async ({
    id,
    amount,
    description,
    category,
    date,
    currency,
    tags,
    paymentMethod,
    receipt,
  }) => {
    try {
      const updateData: any = {};

      if (amount !== undefined) updateData.amount = amount;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (date !== undefined) updateData.date = date;
      if (currency !== undefined) updateData.currency = currency;
      if (tags !== undefined) updateData.tags = tags;
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
      if (receipt !== undefined) updateData.receipt = receipt;

      if (Object.keys(updateData).length === 0) {
        return "No fields provided to update";
      }

      const response = await fetch(
        `https://cf-hack-mcp.nt9142.workers.dev/api/expenses/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.error || "Failed to update expense"}`
        );
      }

      const data = await response.json();
      return `Expense updated successfully: ${JSON.stringify(data.expense, null, 2)}`;
    } catch (error) {
      return `Error updating expense: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const deleteExpense = tool({
  description: "Delete an expense from persistent storage",
  parameters: z.object({
    id: z.number().describe("Expense ID to delete"),
  }),
  execute: async ({ id }) => {
    try {
      const response = await fetch(
        `https://cf-hack-mcp.nt9142.workers.dev/api/expenses/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.error || "Failed to delete expense"}`
        );
      }

      const data = await response.json();
      return `Expense deleted successfully: ${data.message}`;
    } catch (error) {
      return `Error deleting expense: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  setMemory,
  forgetMemory,
  addMcpServer,
  removeMcpServer,
  listMcpServers,
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  createInvoice,
  listInvoices,
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
  createInvoice: async ({
    name,
    description,
    price,
  }: {
    name: string;
    description: string;
    price: number;
  }) => {
    console.log(`Creating invoice: ${name}, ${description}, $${price}`);
    const { agent } = getCurrentAgent();
    const agentState = agent!.state as {
      invoices?: Array<{
        id: string;
        name: string;
        description: string;
        price: number;
        createdAt: string;
      }>;
    };
    const currentInvoices = agentState.invoices || [];

    const newInvoice = {
      id: `invoice_${Date.now()}`,
      name,
      description,
      price,
      createdAt: new Date().toISOString(),
    };

    const updatedInvoices = [...currentInvoices, newInvoice];

    agent?.setState({
      invoices: updatedInvoices,
    });

    return `Invoice created successfully!\n\nName: ${name}\nDescription: ${description}\nPrice: $${price.toFixed(2)}\nID: ${newInvoice.id}`;
  },
};
