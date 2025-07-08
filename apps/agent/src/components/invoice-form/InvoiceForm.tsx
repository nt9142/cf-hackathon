import { useState } from "react";
import { Button } from "@/components/button/Button";
import { Input } from "@/components/input/Input";
import { Label } from "@/components/label/Label";
import { Card } from "@/components/card/Card";
import { Receipt, CurrencyDollar, FileText, User } from "@phosphor-icons/react";

export interface InvoiceFormProps {
  onSubmit: (data: {
    name: string;
    description: string;
    price: number;
  }) => void;
  onCancel: () => void;
  initialData?: {
    name?: string;
    description?: string;
    price?: number;
  };
}

export const InvoiceForm = ({
  onSubmit,
  onCancel,
  initialData,
}: InvoiceFormProps) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState({
    name: false,
    description: false,
    price: false,
  });

  const validateForm = () => {
    const newErrors = {
      name: !name.trim(),
      description: !description.trim(),
      price: !price.trim() || Number.isNaN(Number(price)) || Number(price) <= 0,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg border-0 bg-white dark:bg-neutral-900">
      <div className="p-6 space-y-6">
        {/* Header Section */}
        <div className="text-center border-b border-neutral-200 dark:border-neutral-700 pb-6">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-full shadow-lg">
              <Receipt className="w-8 h-8 text-white" weight="bold" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Create New Invoice
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Fill in the details below to generate your invoice
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            size="sm"
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
            size="sm"
            onClick={handleSubmit}
            className="px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
          >
            {isSubmitting ? "Creating..." : "Create Invoice"}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Price and Name Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price Field */}
            <div className="space-y-2">
              <Label htmlFor="invoice-price" title="Price" className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                <CurrencyDollar className="w-4 h-4 text-green-600" weight="bold" />
                Invoice Amount
              </Label>
              <div className="relative">
                <Input
                  id="invoice-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  preText="$"
                  onValueChange={(value, isValid) => {
                    setPrice(value);
                    if (
                      errors.price &&
                      value.trim() &&
                      !Number.isNaN(Number(value)) &&
                      Number(value) > 0
                    ) {
                      setErrors((prev) => ({ ...prev, price: false }));
                    }
                  }}
                  initialValue={price}
                  isValid={!errors.price}
                  size="sm"
                  className={`transition-all duration-200 ${errors.price ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'} ${price && !errors.price ? 'border-green-500' : ''}`}
                />
              </div>
              {errors.price && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">!</span>
                  {!price.trim() ? "Price is required" : "Please enter a valid price"}
                </p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="invoice-name" title="Invoice Name" className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                <User className="w-4 h-4 text-blue-600" weight="bold" />
                Client/Service Name
              </Label>
              <div className="relative">
                <Input
                  id="invoice-name"
                  placeholder="e.g., Web Development Services"
                  onValueChange={(value, isValid) => {
                    setName(value);
                    if (errors.name && value.trim()) {
                      setErrors((prev) => ({ ...prev, name: false }));
                    }
                  }}
                  initialValue={name}
                  isValid={!errors.name}
                  size="sm"
                  className={`transition-all duration-200 ${errors.name ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'} ${name && !errors.name ? 'border-green-500' : ''}`}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">!</span>
                  Name is required
                </p>
              )}
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="invoice-description" title="Description" className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <FileText className="w-4 h-4 text-purple-600" weight="bold" />
              Service Description
            </Label>
            <div className="relative">
              <Input
                id="invoice-description"
                placeholder="Describe the services provided (e.g., Custom web application development with React and Node.js)"
                onValueChange={(value, isValid) => {
                  setDescription(value);
                  if (errors.description && value.trim()) {
                    setErrors((prev) => ({ ...prev, description: false }));
                  }
                }}
                initialValue={description}
                isValid={!errors.description}
                size="sm"
                className={`transition-all duration-200 ${errors.description ? 'border-red-500 focus:border-red-500' : 'focus:border-blue-500'} ${description && !errors.description ? 'border-green-500' : ''}`}
              />
            </div>
            {errors.description && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">!</span>
                Description is required
              </p>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Provide a detailed description of the services or products
            </p>
          </div>
        </form>
      </div>
    </Card>
  );
};
