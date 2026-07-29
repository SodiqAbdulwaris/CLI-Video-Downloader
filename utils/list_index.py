start = int(input("where are you starting? "))
stop = int(input("Where are you stopping? "))

for i in range(start, stop+1):
    if i == stop:
        print(i)
        break
    print(i, end=", ")