import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Check, Eye } from 'lucide-react'
import useAppStore from '../store/appStore'

const RedactionSidebar: React.FC = () => {
  const { 
    redactionSuggestions, 
    toggleRedactionAcceptance,
    acceptAllRedactions,
    acceptPageRedactions,
    setSelectedRedaction, 
    selectedRedaction,
    setCurrentPage 
  } = useAppStore()

  const getAllSuggestions = () => {
    const allSuggestions: Array<{ page: number, suggestions: typeof redactionSuggestions extends Map<number, infer U> ? U : never }> = []
    redactionSuggestions.forEach((suggestions, page) => {
      if (suggestions.length > 0) {
        allSuggestions.push({ page, suggestions })
      }
    })
    return allSuggestions.sort((a, b) => a.page - b.page)
  }

  const getTotalSuggestions = () => {
    let total = 0
    redactionSuggestions.forEach((suggestions) => {
      total += suggestions.length
    })
    return total
  }

  const getAcceptedCount = () => {
    let accepted = 0
    redactionSuggestions.forEach((suggestions) => {
      accepted += suggestions.filter(s => s.accepted).length
    })
    return accepted
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'PII': return 'bg-red-100 text-red-800'
      case 'CONTACT': return 'bg-blue-100 text-blue-800'
      case 'FINANCIAL': return 'bg-green-100 text-green-800'
      case 'MEDICAL': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleRedactionClick = (suggestion: any) => {
    setSelectedRedaction(suggestion)
    setCurrentPage(suggestion.coordinates.page)
  }

  const allSuggestions = getAllSuggestions()

  if (allSuggestions.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold mb-2">Redaction Suggestions</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground text-center">
            Suggestions will appear here as pages are processed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed at top */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Redaction Suggestions</h2>
          <Button 
            onClick={acceptAllRedactions}
            size="sm"
            className="h-8"
            disabled={getTotalSuggestions() === 0}
          >
            Approve All
          </Button>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{getTotalSuggestions()} found</span>
          <span>•</span>
          <span>{getAcceptedCount()} accepted</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Accordion type="multiple" className="w-full">
          {allSuggestions.map(({ page, suggestions }) => (
            <AccordionItem key={page} value={`page-${page}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full mr-4">
                  <span>Page {page}</span>
                  <Badge variant="secondary">{suggestions.length} items</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {/* Accept All button for this page */}
                  <div className="flex justify-end mb-3">
                    <Button
                      onClick={() => acceptPageRedactions(page)}
                      size="sm"
                      variant="outline"
                      disabled={suggestions.every(s => s.accepted) || suggestions.length === 0}
                    >
                      Accept All on Page {page}
                    </Button>
                  </div>
                  
                  {suggestions.map((suggestion) => (
                    <Card 
                      key={suggestion.id} 
                      className={`cursor-pointer transition-colors ${
                        selectedRedaction?.id === suggestion.id 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRedactionClick(suggestion)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge className={getCategoryColor(suggestion.category)}>
                            {suggestion.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm font-medium mb-2 break-words">
                          {suggestion.text}
                        </p>
                        {suggestion.reason && (
                          <p className="text-xs text-muted-foreground mb-3">
                            {suggestion.reason}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={suggestion.accepted ? "default" : "outline"}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRedactionAcceptance(page, suggestion.id)
                            }}
                            className="flex-1"
                          >
                            {suggestion.accepted ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Accepted
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Accept
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRedactionClick(suggestion)
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}

export default RedactionSidebar
